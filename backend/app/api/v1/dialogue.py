"""
AI 对话 API 路由（整合 KouriChat 核心逻辑）

支持三种对话形式：
1. 原生软件内对话（Web UI 直接对话）
2. 微信聊天转接（KouriChat 微信消息转发）
3. QQ 聊天转接（待开发）

MnemoTranscode：指定 member_id 时可走图记忆 + 扩散激活 + 意识召回；失败自动回退传统模式。
"""

import logging
import re
import time

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, func, select
from typing import Literal

from app.core.database import get_db
from app.models.user import User
from app.models.memory import Memory, Member, Archive
from app.models.dialogue import DialogueChatMessage
from app.api.v1.auth import get_current_user
from app.services.llm_service import LLMService
from app.services.vector_service import VectorService
from app.core.config import get_settings
from app.schemas.client_llm import ClientLlmOverride
from app.services.usage_metering import record_token_usage

router = APIRouter(prefix="/dialogue", tags=["AI对话"])
settings = get_settings()
logger = logging.getLogger(__name__)


class DialogueRequest(BaseModel):
    """对话请求"""
    message: str = Field(..., min_length=1, max_length=4000)
    archive_id: int | None = None
    member_id: int | None = None
    channel: Literal["app", "wechat", "qq"] = "app"  # 对话渠道
    session_id: str | None = None  # 用于跨请求的会话上下文追踪
    history_limit: int = Field(default=10, ge=0, le=50)  # 携带的历史消息条数
    # 前端 localStorage 恢复的对话（优先于进程内字典，避免刷新后服务端无上下文）
    client_history: list[dict] | None = None
    # 与前端「模型设置」一致：附带则优先于服务端 LLM_* 环境变量（OpenAI 兼容网关）
    client_llm: ClientLlmOverride | None = None
    # 在本轮 user+assistant 写入会话后，用 LLM 提炼记忆并写入链式图（略增加耗时）
    extract_memories_after: bool = False


class DialogueResponse(BaseModel):
    """对话响应"""
    reply: str
    channel: str
    member_id: int | None = None
    member_name: str | None = None
    tts_audio_url: str | None = None
    session_id: str | None = None
    # 本轮是否走了 MnemoTranscode（图记忆 + 扩散激活 + 意识召回）
    mnemo_mode: bool = False
    # extract_memories_after 为 true 时，从本轮对话中新写入的记忆条数
    memories_created: int = 0
    # 本轮 LLM 元数据（供前端展示；无 usage 时部分字段为空）
    model_used: str | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    latency_ms: int | None = None
    # 无官方 completion_tokens 时，以前端展示的粗略「等效」速度：字符数/秒
    output_chars: int | None = None


class DialogueHistoryRequest(BaseModel):
    """获取对话历史"""
    session_id: str
    archive_id: int | None = None
    member_id: int | None = None
    limit: int = Field(default=20, ge=1, le=100)


class DialogueHistoryResponse(BaseModel):
    """对话历史响应"""
    session_id: str
    messages: list[dict]


class DialogueListResponse(BaseModel):
    messages: list[dict]


class BootstrapHistoryBody(BaseModel):
    archive_id: int = Field(..., gt=0)
    member_id: int = Field(..., gt=0)
    messages: list[dict] = Field(default_factory=list, max_length=500)


# 内存中的对话历史存储（生产环境应使用 Redis）
_dialogue_sessions: dict[str, list[dict]] = {}


async def _require_owned_member(
    db: AsyncSession, current_user: User, archive_id: int, member_id: int
) -> Member:
    """校验成员属于当前用户且 archive_id 一致。"""
    result = await db.execute(
        select(Member)
        .join(Archive, Member.archive_id == Archive.id)
        .where(
            Member.id == member_id,
            Member.archive_id == archive_id,
            Archive.owner_id == current_user.id,
        )
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="成员不存在或无权访问")
    return m


async def _db_turn_count(db: AsyncSession, *, user_id: int, member_id: int) -> int:
    c = await db.scalar(
        select(func.count())
        .select_from(DialogueChatMessage)
        .where(DialogueChatMessage.user_id == user_id, DialogueChatMessage.member_id == member_id)
    )
    return int(c or 0)


async def _load_db_turns(
    db: AsyncSession,
    *,
    user_id: int,
    member_id: int,
    archive_id: int | None = None,
    max_rows: int = 400,
) -> list[dict]:
    """读取库中最新消息（按时序 user/assistant 文本）。"""
    conds = [
        DialogueChatMessage.user_id == user_id,
        DialogueChatMessage.member_id == member_id,
    ]
    if archive_id is not None:
        conds.append(DialogueChatMessage.archive_id == archive_id)
    stmt = (
        select(DialogueChatMessage)
        .where(*conds)
        .order_by(DialogueChatMessage.id.desc())
        .limit(max(1, min(max_rows, 500)))
    )
    r = await db.execute(stmt)
    rows = list(reversed(r.scalars().all()))
    return [{"role": m.role, "content": m.content} for m in rows]


async def _bulk_insert_normalized_turns(
    db: AsyncSession,
    *,
    user_id: int,
    archive_id: int,
    member_id: int,
    normalized: list[dict],
) -> None:
    for item in normalized:
        db.add(
            DialogueChatMessage(
                user_id=user_id,
                archive_id=archive_id,
                member_id=member_id,
                role=item["role"],
                content=item["content"],
            )
        )
    await db.flush()


async def _persist_chat_turn(
    db: AsyncSession,
    *,
    user_id: int,
    archive_id: int,
    member_id: int,
    user_text: str,
    assistant_reply: str,
) -> None:
    ut = user_text.strip()[:12000]
    ar = assistant_reply.strip()[:12000]
    db.add_all(
        [
            DialogueChatMessage(
                user_id=user_id,
                archive_id=archive_id,
                member_id=member_id,
                role="user",
                content=ut,
            ),
            DialogueChatMessage(
                user_id=user_id,
                archive_id=archive_id,
                member_id=member_id,
                role="assistant",
                content=ar,
            ),
        ]
    )
    await db.flush()


def _normalize_client_history(raw: list[dict] | None, *, max_turns: int) -> list[dict] | None:
    """仅保留 user/assistant 与文本 content，防止异常负载。"""
    if not raw:
        return None
    out: list[dict] = []
    for item in raw[-max_turns:]:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        if role not in ("user", "assistant"):
            continue
        content = item.get("content", "")
        if not isinstance(content, str):
            content = str(content)
        content = content.strip()
        if len(content) > 12000:
            content = content[:12000]
        out.append({"role": role, "content": content})
    return out or None


def _llm_from_dialogue_request(request: DialogueRequest) -> LLMService:
    if request.client_llm:
        ov = request.client_llm
        return LLMService(api_key=ov.api_key or "", base_url=ov.base_url, model=ov.model)
    return LLMService()


@router.post("/chat", response_model=DialogueResponse)
async def chat(
    request: DialogueRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    发送对话消息并获取 AI 回复

    - **message**: 用户消息
    - **archive_id**: 档案 ID（指定与哪个档案的"角色"对话）
    - **member_id**: 成员 ID（指定与哪个具体成员对话）
    - **channel**: 对话渠道（app=原生软件, wechat=微信, qq=QQ）
    - **session_id**: 会话 ID（用于跨请求保持上下文）
    """
    session_id = (
        request.session_id
        if request.session_id is not None
        else (
            f"dlg_{request.archive_id}_{request.member_id}"
            if request.archive_id and request.member_id
            else f"{current_user.id}_{request.member_id or 'anon'}"
        )
    )

    member_context = ""
    member_name = "AI 助手"
    member_id = request.member_id
    member_obj: Member | None = None

    if request.member_id and request.archive_id:
        member_obj = await _require_owned_member(
            db, current_user, int(request.archive_id), int(request.member_id)
        )
        member_name = member_obj.name
        member_id = member_obj.id
        member_context = await _build_member_context(member_obj, request.archive_id, db)
    elif request.member_id:
        result = await db.execute(
            select(Member)
            .join(Archive, Member.archive_id == Archive.id)
            .where(Member.id == request.member_id, Archive.owner_id == current_user.id)
        )
        member = result.scalar_one_or_none()
        if member:
            member_obj = member
            member_name = member.name
            member_id = member.id
            member_context = await _build_member_context(member, request.archive_id, db)

    client_norm_full = _normalize_client_history(request.client_history, max_turns=200)
    use_db = bool(
        member_obj is not None
        and request.archive_id is not None
        and request.member_id is not None
        and int(member_obj.archive_id) == int(request.archive_id)
    )

    if use_db and member_obj is not None and request.archive_id is not None:
        cnt_before = await _db_turn_count(db, user_id=current_user.id, member_id=member_obj.id)
        if cnt_before == 0 and client_norm_full:
            await _bulk_insert_normalized_turns(
                db,
                user_id=current_user.id,
                archive_id=int(request.archive_id),
                member_id=member_obj.id,
                normalized=list(client_norm_full),
            )
        stored_turns = await _load_db_turns(
            db,
            user_id=current_user.id,
            member_id=member_obj.id,
            archive_id=int(request.archive_id),
            max_rows=400,
        )
        history = stored_turns[-request.history_limit :]
    elif client_norm_full is not None:
        history = client_norm_full[-request.history_limit :]
    else:
        history = _dialogue_sessions.get(session_id, [])[-request.history_limit :]

    use_mnemo = (
        settings.mnemo_transcode_enabled
        and request.member_id
        and member_obj is not None
    )
    reply: str
    mnemo_mode = False
    usage_bundle: dict = {}
    t0 = time.perf_counter()
    if use_mnemo:
        try:
            reply, usage_bundle = await _chat_mnemo_pipeline(
                db=db,
                current_user=current_user,
                request=request,
                member=member_obj,
                member_name=member_name,
                history=history,
            )
            mnemo_mode = True
        except Exception as exc:
            logger.exception("Mnemo 对话管线失败，回退传统模式: %s", exc)
            reply, usage_bundle = await _chat_llm_only(request, member_name, member_context, history)
    else:
        reply, usage_bundle = await _chat_llm_only(request, member_name, member_context, history)
    latency_ms = int((time.perf_counter() - t0) * 1000)

    if use_db and member_obj is not None and request.archive_id is not None:
        await _persist_chat_turn(
            db,
            user_id=current_user.id,
            archive_id=int(request.archive_id),
            member_id=member_obj.id,
            user_text=request.message,
            assistant_reply=reply,
        )
    elif client_norm_full is not None:
        _dialogue_sessions[session_id] = list(client_norm_full) + [
            {"role": "user", "content": request.message},
            {"role": "assistant", "content": reply},
        ]
    else:
        if session_id not in _dialogue_sessions:
            _dialogue_sessions[session_id] = []
        _dialogue_sessions[session_id].append({"role": "user", "content": request.message})
        _dialogue_sessions[session_id].append({"role": "assistant", "content": reply})

    memories_created = 0
    extract_usage: dict = {}
    if request.extract_memories_after and member_obj is not None:
        try:
            from app.services.conversation_memory_extract import extract_and_save_memories

            if use_db and request.archive_id is not None:
                full_turns = await _load_db_turns(
                    db,
                    user_id=current_user.id,
                    member_id=member_obj.id,
                    archive_id=int(request.archive_id),
                    max_rows=120,
                )
            else:
                full_turns = _dialogue_sessions.get(session_id, [])
            ex_llm = _llm_from_dialogue_request(request)
            created, _stats, extract_usage = await extract_and_save_memories(
                db,
                user_id=current_user.id,
                member_id=member_obj.id,
                messages=full_turns,
                llm=ex_llm,
                build_graph=True,
            )
            memories_created = len(created)
            await record_token_usage(
                db,
                user_id=current_user.id,
                action_type="memory_extract",
                usage_bundle=extract_usage,
                client_llm=request.client_llm,
                session_id=session_id,
            )
        except Exception as exc:
            logger.exception("对话后提炼记忆失败: %s", exc)

    await record_token_usage(
        db,
        user_id=current_user.id,
        action_type="dialogue",
        usage_bundle=usage_bundle,
        client_llm=request.client_llm,
        session_id=session_id,
    )

    ct = usage_bundle.get("completion_tokens")
    pc = usage_bundle.get("prompt_tokens")
    if isinstance(ct, bool):
        ct = None
    if isinstance(pc, bool):
        pc = None
    try:
        ct_i = int(ct) if ct is not None else None
    except (TypeError, ValueError):
        ct_i = None
    try:
        pc_i = int(pc) if pc is not None else None
    except (TypeError, ValueError):
        pc_i = None

    return DialogueResponse(
        reply=reply,
        channel=request.channel,
        member_id=member_id,
        member_name=member_name,
        session_id=session_id,
        mnemo_mode=mnemo_mode,
        memories_created=memories_created,
        model_used=usage_bundle.get("model"),
        prompt_tokens=pc_i,
        completion_tokens=ct_i,
        latency_ms=latency_ms,
        output_chars=len(reply),
    )


async def _chat_llm_only(
    request: DialogueRequest,
    member_name: str,
    member_context: str,
    history: list[dict],
) -> tuple[str, dict]:
    system_prompt = _build_system_prompt(
        member_name=member_name,
        member_context=member_context,
        channel=request.channel,
    )
    usage_out: dict = {}
    try:
        if request.client_llm:
            ov = request.client_llm
            llm_service = LLMService(
                api_key=ov.api_key or "",
                base_url=ov.base_url,
                model=ov.model,
            )
        else:
            llm_service = LLMService()
        text = await llm_service.get_response(
            message=request.message,
            system_prompt=system_prompt,
            history=history,
            usage_out=usage_out,
        )
        return text, usage_out
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 服务调用失败: {str(e)}") from e


async def _chat_mnemo_pipeline(
    *,
    db: AsyncSession,
    current_user: User,
    request: DialogueRequest,
    member: Member,
    member_name: str,
    history: list[dict],
) -> tuple[str, dict]:
    from app.mnemo.graph_sql import SqlAlchemyGraphManager
    from app.mnemo.activation_engine import ActivationEngine
    from app.mnemo.conscious_recall import ConsciousRecall, self_core_from_member
    from app.mnemo.chat_pipeline import ChatPipeline
    from app.mnemo.sync_memories import bootstrap_member_engrams, ensure_member_person_anchor

    await bootstrap_member_engrams(db, member.id, current_user.id)
    await ensure_member_person_anchor(db, member, current_user.id)

    graph = SqlAlchemyGraphManager(db, current_user.id)
    activation = ActivationEngine(graph)
    vector = VectorService()
    ov = request.client_llm
    recall = ConsciousRecall(
        graph=graph,
        activation_engine=activation,
        vector=vector,
        user_id=current_user.id,
        member_id=member.id,
        embedding_api_key=(ov.api_key if ov else None) or None,
        embedding_base_url=(ov.base_url if ov else None) or None,
    )
    if request.client_llm:
        ov2 = request.client_llm
        llm = LLMService(api_key=ov2.api_key or "", base_url=ov2.base_url, model=ov2.model)
    else:
        llm = LLMService()

    base_system = _build_system_prompt_mnemo(
        member_name=member_name,
        member_context_slim=await _build_member_context_slim(member, db),
        channel=request.channel,
    )
    pipeline = ChatPipeline(
        graph=graph,
        activation=activation,
        recall=recall,
        llm=llm,
        self_core=self_core_from_member(member),
        base_system_prompt=base_system,
        member_id=member.id,
        consolidator=None,
    )
    return await pipeline.chat(request.message, history=history)


@router.get("/messages", response_model=DialogueListResponse)
async def list_dialogue_messages(
    archive_id: int = Query(..., gt=0),
    member_id: int = Query(..., gt=0),
    limit: int = Query(400, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """账号级会话消息（时间正序）；用于多端与换设备后与本地 localStorage 解耦"""
    await _require_owned_member(db, current_user, archive_id, member_id)
    stmt = (
        select(DialogueChatMessage)
        .where(
            DialogueChatMessage.user_id == current_user.id,
            DialogueChatMessage.archive_id == archive_id,
            DialogueChatMessage.member_id == member_id,
        )
        .order_by(DialogueChatMessage.id.desc())
        .limit(limit)
    )
    r = await db.execute(stmt)
    rows = list(reversed(r.scalars().all()))
    return DialogueListResponse(
        messages=[
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in rows
        ]
    )


@router.post("/messages/bootstrap")
async def bootstrap_dialogue_messages(
    body: BootstrapHistoryBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """仅在库内该成员会话为空时，一次性导入前端 localStorage（避免重复 INSERT）"""
    m = await _require_owned_member(db, current_user, body.archive_id, body.member_id)
    if await _db_turn_count(db, user_id=current_user.id, member_id=m.id) > 0:
        return {"imported": 0, "skipped": True}
    norm = _normalize_client_history(body.messages, max_turns=500)
    if not norm:
        return {"imported": 0, "skipped": False}
    await _bulk_insert_normalized_turns(
        db,
        user_id=current_user.id,
        archive_id=m.archive_id,
        member_id=m.id,
        normalized=list(norm),
    )
    return {"imported": len(norm), "skipped": False}


@router.post("/history", response_model=DialogueHistoryResponse)
async def get_history(
    request: DialogueHistoryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取对话历史（优先读库）"""
    if request.archive_id and request.member_id:
        await _require_owned_member(db, current_user, request.archive_id, request.member_id)
        msgs = await _load_db_turns(
            db,
            user_id=current_user.id,
            member_id=request.member_id,
            archive_id=request.archive_id,
            max_rows=request.limit,
        )
        return DialogueHistoryResponse(
            session_id=request.session_id,
            messages=msgs[-request.limit :],
        )
    messages = _dialogue_sessions.get(request.session_id, [])[-request.limit :]
    return DialogueHistoryResponse(
        session_id=request.session_id,
        messages=messages,
    )


@router.delete("/history")
async def clear_history_by_member(
    archive_id: int = Query(..., gt=0),
    member_id: int = Query(..., gt=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """按档案+成员清空账号级会话"""
    member = await _require_owned_member(db, current_user, archive_id, member_id)
    await db.execute(
        delete(DialogueChatMessage).where(
            DialogueChatMessage.user_id == current_user.id,
            DialogueChatMessage.member_id == member.id,
        )
    )
    sid = f"dlg_{archive_id}_{member_id}"
    _dialogue_sessions.pop(sid, None)
    return {"status": "ok"}


@router.delete("/history/{session_id}")
async def clear_history_legacy(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """兼容旧会话 id：dlg_{archive}_{member} 或内存随机 key"""
    m = re.fullmatch(r"dlg_(\d+)_(\d+)", session_id)
    if m:
        aid, mid = int(m.group(1)), int(m.group(2))
        try:
            mem = await _require_owned_member(db, current_user, aid, mid)
            await db.execute(
                delete(DialogueChatMessage).where(
                    DialogueChatMessage.user_id == current_user.id,
                    DialogueChatMessage.member_id == mem.id,
                )
            )
        except HTTPException:
            pass
    if session_id in _dialogue_sessions:
        del _dialogue_sessions[session_id]
    return {"status": "ok"}


def _build_system_prompt(member_name: str, member_context: str, channel: str) -> str:
    """构建系统提示词"""
    channel_desc = {
        "app": "在 MTC 应用内直接对话",
        "wechat": "通过微信消息与你对话",
        "qq": "通过 QQ 消息与你对话",
    }

    return f"""你是一个有着温暖灵魂的数字人物，名叫 {member_name}。
{member_context}

## 对话规则
- 用 {member_name} 的口吻和性格来回应
- 回忆中的往事用第一人称叙述，仿佛你真的经历过
- 保持对话的情感温度，不要过于机械
- 回复应该简洁自然，符合日常对话节奏
- 如果有人问到你记忆中不存在的事情，诚实但温和地回应

## 当前对话渠道
{channel_desc.get(channel, "应用内对话")}

请以 {member_name} 的身份回复：
"""


def _build_system_prompt_mnemo(
    member_name: str,
    member_context_slim: str,
    channel: str,
) -> str:
    """Mnemo 路径：具体记忆由意识前置流注入，此处仅保留角色与渠道约束。"""
    channel_desc = {
        "app": "在 MTC 应用内直接对话",
        "wechat": "通过微信消息与你对话",
        "qq": "通过 QQ 消息与你对话",
    }
    return f"""你是数字角色「{member_name}」。
{member_context_slim}

## 对话规则
- 用 {member_name} 的口吻回应；下文「意识前置流」中的激活记忆是你此刻可用的内在联想材料
- 以第一人称自然对话，避免机械罗列
- 对记忆中不存在的内容诚实、温和

## 当前对话渠道
{channel_desc.get(channel, "应用内对话")}
"""


async def _build_member_context_slim(member: Member, db: AsyncSession) -> str:
    """Mnemo 用精简档案（长篇记忆由图激活补充）。"""
    parts: list[str] = []
    if member.bio:
        parts.append(f"人物简介：{member.bio}")
    if member.relationship_type:
        parts.append(f"与你的关系：{member.relationship_type}")
    if member.birth_year:
        birth_info = f"出生于 {member.birth_year} 年"
        if member.end_year:
            birth_info += f"（关系节点至 {member.end_year} 年）"
        parts.append(birth_info)
    if member.emotion_tags:
        parts.append(f"情感标签：{', '.join(member.emotion_tags)}")
    return "\n".join(parts) if parts else "暂无详细背景信息。"


async def _build_member_context(member, archive_id, db: AsyncSession) -> str:
    """从数据库构建成员上下文"""
    context_parts = []

    if member.bio:
        context_parts.append(f"人物简介：{member.bio}")

    if member.relationship_type:
        context_parts.append(f"与你的关系：{member.relationship_type}")

    if member.birth_year:
        birth_info = f"出生于 {member.birth_year} 年"
        if getattr(member, "end_year", None):
            birth_info += f"（关系节点至 {member.end_year} 年）"
        context_parts.append(birth_info)

    if member.emotion_tags:
        context_parts.append(f"情感标签：{', '.join(member.emotion_tags)}")

    # 获取该成员的记忆摘要
    result = await db.execute(
        select(Memory)
        .where(Memory.member_id == member.id)
        .order_by(Memory.timestamp.desc())
        .limit(5)
    )
    recent_memories = result.scalars().all()
    if recent_memories:
        context_parts.append("\n## 近期记忆片段")
        for mem in recent_memories:
            context_parts.append(f"- {mem.title}: {mem.content_text[:100]}...")

    return "\n".join(context_parts) if context_parts else "暂无详细背景信息。"
