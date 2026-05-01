"""
AI 对话 API 路由（整合 KouriChat 核心逻辑）

支持三种对话形式：
1. 原生软件内对话（Web UI 直接对话）
2. 微信聊天转接（KouriChat 微信消息转发）
3. QQ 聊天转接（待开发）
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Literal

from app.core.database import get_db
from app.models.user import User
from app.models.memory import Memory, Member, Archive
from app.api.v1.auth import get_current_user
from app.services.llm_service import LLMService
from app.services.vector_service import VectorService
from app.core.config import get_settings
from app.schemas.client_llm import ClientLlmOverride

router = APIRouter(prefix="/dialogue", tags=["AI对话"])
settings = get_settings()


class DialogueRequest(BaseModel):
    """对话请求"""
    message: str = Field(..., min_length=1, max_length=4000)
    archive_id: int | None = None
    member_id: int | None = None
    channel: Literal["app", "wechat", "qq"] = "app"  # 对话渠道
    session_id: str | None = None  # 用于跨请求的会话上下文追踪
    history_limit: int = Field(default=10, ge=0, le=50)  # 携带的历史消息条数
    # 与前端「模型设置」一致：附带则优先于服务端 LLM_* 环境变量（OpenAI 兼容网关）
    client_llm: ClientLlmOverride | None = None


class DialogueResponse(BaseModel):
    """对话响应"""
    reply: str
    channel: str
    member_id: int | None = None
    member_name: str | None = None
    tts_audio_url: str | None = None
    session_id: str | None = None


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


# 内存中的对话历史存储（生产环境应使用 Redis）
_dialogue_sessions: dict[str, list[dict]] = {}


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
    session_id = request.session_id or f"{current_user.id}_{request.member_id or 'anon'}"

    # 获取成员信息和档案上下文
    member_context = ""
    member_name = "AI 助手"
    member_id = request.member_id

    if request.member_id:
        result = await db.execute(
            select(Member)
            .join(Archive, Member.archive_id == Archive.id)
            .where(Member.id == request.member_id, Archive.owner_id == current_user.id)
        )
        member = result.scalar_one_or_none()
        if member:
            member_name = member.name
            member_id = member.id
            member_context = _build_member_context(member, request.archive_id, db)

    # 构建 system prompt
    system_prompt = _build_system_prompt(
        member_name=member_name,
        member_context=member_context,
        channel=request.channel,
    )

    # 获取历史消息
    history = _dialogue_sessions.get(session_id, [])[-request.history_limit:]

    # 调用 LLM（可选使用浏览器端传来的 OpenAI 兼容端点）
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
        reply = await llm_service.get_response(
            message=request.message,
            system_prompt=system_prompt,
            history=history,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 服务调用失败: {str(e)}")

    # 更新对话历史
    if session_id not in _dialogue_sessions:
        _dialogue_sessions[session_id] = []
    _dialogue_sessions[session_id].append({"role": "user", "content": request.message})
    _dialogue_sessions[session_id].append({"role": "assistant", "content": reply})

    return DialogueResponse(
        reply=reply,
        channel=request.channel,
        member_id=member_id,
        member_name=member_name,
        session_id=session_id,
    )


@router.post("/history", response_model=DialogueHistoryResponse)
async def get_history(
    request: DialogueHistoryRequest,
    current_user: User = Depends(get_current_user),
):
    """获取对话历史"""
    messages = _dialogue_sessions.get(request.session_id, [])[-request.limit:]
    return DialogueHistoryResponse(
        session_id=request.session_id,
        messages=messages,
    )


@router.delete("/history/{session_id}")
async def clear_history(
    session_id: str,
    current_user: User = Depends(get_current_user),
):
    """清除对话历史"""
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


async def _build_member_context(member, archive_id, db: AsyncSession) -> str:
    """从数据库构建成员上下文"""
    context_parts = []

    if member.bio:
        context_parts.append(f"人物简介：{member.bio}")

    if member.relationship_type:
        context_parts.append(f"与你的关系：{member.relationship_type}")

    if member.birth_year:
        birth_info = f"出生于 {member.birth_year} 年"
        if member.death_year:
            birth_info += f"，于 {member.death_year} 年去世"
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
