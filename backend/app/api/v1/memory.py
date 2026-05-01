"""
记忆 CRUD API 路由
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.exceptions import DomainAuthError, DomainInternalError, DomainResourceError
from app.models.user import User
from app.models.memory import Memory, Member, Archive
from app.schemas.memory import (
    MemoryCreate,
    MemoryUpdate,
    MemoryResponse,
    MemorySearchRequest,
    MemorySearchResponse,
    MemoryBatchDeleteRequest,
    MemoryBatchDeleteResponse,
    ChatImportRequest,
    ChatImportStreamRequest,
    ChatImportResponse,
    ConversationExtractRequest,
    ConversationExtractResponse,
    MnemoGraphResponse,
    MnemoGraphNode,
    MnemoGraphEdge,
)
from app.api.v1.auth import get_current_user
from app.services.vector_service import VectorService
from app.core.config import get_settings
from app.models.engram import EngramNode, EngramEdge
from app.mnemo.sync_memories import ensure_memory_engram
from app.mnemo.chain_enricher import enrich_after_memories_created
from app.services.chat_import_parser import parse_chat_import
from app.services.chat_import_ai import stream_chat_import
from app.services.conversation_memory_extract import extract_and_save_memories
from app.services.llm_service import LLMService
from app.services.usage_metering import record_token_usage

router = APIRouter(prefix="/memories", tags=["记忆"])
settings = get_settings()
logger = logging.getLogger(__name__)

# 返回 MemoryResponse 时需带出档案名、角色名
_MEMORY_MEMBER_ARCHIVE = selectinload(Memory.member).selectinload(Member.archive)


async def _delete_engram_event_nodes_for_memories(
    db: AsyncSession,
    user_id: int,
    memory_ids: list[int],
) -> None:
    """删除业务记忆时同步删除绑定的 Engram 事件节点。

    engram_nodes.memory_id 外键为 ON DELETE SET NULL，仅删 Memory 会留下孤儿节点，
    关系网仍显示旧结点；故在删 Memory 之前按 memory_id 清除对应节点（边随节点 CASCADE）。
    """
    if not memory_ids:
        return
    await db.execute(
        delete(EngramNode).where(
            EngramNode.user_id == user_id,
            EngramNode.memory_id.in_(memory_ids),
        )
    )


def memory_to_response(m: Memory) -> MemoryResponse:
    """Memory ORM 无 archive_id 列，需从已加载的 member 填充。"""
    if m.member is None:
        raise ValueError("Memory.member must be loaded (use selectinload)")
    arch = m.member.archive
    archive_name = arch.name if arch is not None else None
    return MemoryResponse(
        id=m.id,
        title=m.title,
        content_text=m.content_text,
        timestamp=m.timestamp,
        location=m.location,
        member_id=m.member_id,
        archive_id=m.member.archive_id,
        member_name=m.member.name,
        archive_name=archive_name,
        emotion_label=m.emotion_label,
        vector_embedding_id=m.vector_embedding_id,
        is_capsule=m.is_capsule,
        unlock_date=m.unlock_date,
        media_refs=list(m.media_refs) if m.media_refs is not None else [],
        created_at=m.created_at,
        updated_at=m.updated_at,
    )


async def _require_member_for_user(db: AsyncSession, current_user: User, member_id: int) -> Member:
    result = await db.execute(
        select(Member)
        .join(Archive, Member.archive_id == Archive.id)
        .where(Member.id == member_id, Archive.owner_id == current_user.id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="成员不存在或无权访问")
    return member


@router.post("/import-chat", response_model=ChatImportResponse)
@router.post("/chat-import", response_model=ChatImportResponse)
async def import_chat_log(
    body: ChatImportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """导入微信/聊天工具导出的纯文本，批量建记忆并构图。"""
    await _require_member_for_user(db, current_user, body.member_id)
    drafts = parse_chat_import(body.raw_text, source=body.source)
    if not drafts:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="未能从文本中解析出有效片段")

    # 大批量：跳过每条记忆的 embedding+Qdrant，避免单次 HTTP 请求内数百次远程调用导致内存暴涨或 Docker OOM
    vector_sync_threshold = 72
    defer_vector = len(drafts) > vector_sync_threshold
    if defer_vector:
        logger.info(
            "导入片段 %s 条超过阈值 %s，本批次跳过向量同步（构图仍可用）",
            len(drafts),
            vector_sync_threshold,
        )

    created_ids: list[int] = []
    batch_commit_every = 25
    for idx, d in enumerate(drafts[:500]):
        ts = d.occurred_at or datetime.now(timezone.utc)
        memory = Memory(
            title=d.title[:200],
            content_text=d.content_text[:20000],
            member_id=body.member_id,
            timestamp=ts,
            emotion_label=None,
        )
        db.add(memory)
        await db.flush()
        await db.refresh(memory)
        created_ids.append(memory.id)
        try:
            await ensure_memory_engram(
                db,
                memory,
                current_user.id,
                with_vector=not defer_vector,
            )
        except Exception as exc:
            logger.warning("导入记忆入图失败 id=%s: %s", memory.id, exc)

        if (idx + 1) % batch_commit_every == 0:
            await db.commit()

    await db.commit()

    mem_rows = await db.execute(select(Memory).where(Memory.id.in_(created_ids)))
    created = list(mem_rows.scalars().all())

    llm = LLMService()
    stats = {"temporal_edges": 0, "llm_edges": 0}
    if body.build_graph and len(created) >= 2:
        try:
            stats = await enrich_after_memories_created(db, current_user.id, created, llm)
        except Exception as exc:
            logger.warning("导入后构图失败: %s", exc)

    return ChatImportResponse(
        created_count=len(created),
        memory_ids=[m.id for m in created],
        graph_temporal_edges=int(stats.get("temporal_edges", 0)),
        graph_llm_edges=int(stats.get("llm_edges", 0)),
        vectors_deferred=defer_vector,
    )


@router.post("/import-chat/stream")
@router.post("/chat-import/stream")
async def import_chat_log_stream(
    body: ChatImportStreamRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """流式导入：解析 → 多批 LLM 精炼（可关闭）→ 持久化 → 关系网；进度页实时展示。"""
    await _require_member_for_user(db, current_user, body.member_id)

    async def gen():
        async for chunk in stream_chat_import(
            db,
            user_id=current_user.id,
            member_id=body.member_id,
            raw_text=body.raw_text,
            source=body.source,
            build_graph=body.build_graph,
            ai_refine=body.ai_refine,
            client_llm=body.client_llm,
        ):
            yield chunk

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@router.post("/extract-from-conversation", response_model=ConversationExtractResponse)
async def extract_from_conversation(
    body: ConversationExtractRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """根据多轮对话（user/assistant）提炼记忆并写入链式图。"""
    await _require_member_for_user(db, current_user, body.member_id)
    if body.client_llm:
        ov = body.client_llm
        llm = LLMService(api_key=ov.api_key or "", base_url=ov.base_url, model=ov.model)
    else:
        llm = LLMService()
    created, stats, extract_ub = await extract_and_save_memories(
        db,
        user_id=current_user.id,
        member_id=body.member_id,
        messages=body.messages,
        llm=llm,
        build_graph=body.build_graph,
    )

    await record_token_usage(
        db,
        user_id=current_user.id,
        action_type="memory_extract",
        usage_bundle=extract_ub,
        client_llm=body.client_llm,
        session_id=None,
    )
    return ConversationExtractResponse(
        created_count=len(created),
        memory_ids=[m.id for m in created],
        graph_temporal_edges=int(stats.get("temporal_edges", 0)),
        graph_llm_edges=int(stats.get("llm_edges", 0)),
    )


@router.get("/mnemo-graph", response_model=MnemoGraphResponse)
async def get_mnemo_graph(
    member_id: int = Query(..., ge=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """成员名下 Engram 节点与边（用于关系网展示）。"""
    await _require_member_for_user(db, current_user, member_id)
    nr = await db.execute(
        select(EngramNode).where(
            EngramNode.member_id == member_id,
            EngramNode.user_id == current_user.id,
            EngramNode.is_deprecated.is_(False),
        )
    )
    nodes_orm = list(nr.scalars().all())
    # 事件节点必须与 memories 对齐；Person 为锚点可常驻；Ev/情感等挂载记忆的结点须带仍在库中的 memory_id
    mem_ids_r = await db.execute(select(Memory.id).where(Memory.member_id == member_id))
    valid_memory_ids = {row[0] for row in mem_ids_r.all()}
    filtered: list[EngramNode] = []
    for n in nodes_orm:
        if n.memory_id is not None:
            if n.memory_id in valid_memory_ids:
                filtered.append(n)
            continue
        if n.node_type == "Event":
            # 事件节点应对应 memories 行；历史上删记忆仅 SET NULL 会留下 ghost Event
            continue
        filtered.append(n)
    nodes_orm = filtered
    node_ids = {n.id for n in nodes_orm}
    if not node_ids:
        return MnemoGraphResponse(member_id=member_id, nodes=[], edges=[])

    er = await db.execute(
        select(EngramEdge).where(
            EngramEdge.from_node_id.in_(node_ids),
            EngramEdge.to_node_id.in_(node_ids),
        )
    )
    edges_orm = list(er.scalars().all())

    # 去掉历史上因 memory_id 为空的孤儿 Emotion/Event 片段：不参与任何联结且非 Person、无现存记忆支撑
    endpoint_ids: set[str] = set()
    for e in edges_orm:
        endpoint_ids.add(e.from_node_id)
        endpoint_ids.add(e.to_node_id)
    pruned_nodes: list[EngramNode] = []
    for n in nodes_orm:
        if n.node_type == "Person":
            pruned_nodes.append(n)
            continue
        if n.memory_id is not None and n.memory_id in valid_memory_ids:
            pruned_nodes.append(n)
            continue
        if n.id in endpoint_ids:
            pruned_nodes.append(n)
        # 其余结点（多为旧版未绑 memory_id 的情感结点）不落图
    nodes_orm = pruned_nodes
    node_ids = {n.id for n in nodes_orm}
    if not node_ids:
        return MnemoGraphResponse(member_id=member_id, nodes=[], edges=[])
    edges_orm = [e for e in edges_orm if e.from_node_id in node_ids and e.to_node_id in node_ids]

    nodes = [
        MnemoGraphNode(
            id=n.id,
            node_type=n.node_type,
            label=(n.content or "")[:80] + ("…" if len(n.content or "") > 80 else ""),
            memory_id=n.memory_id,
        )
        for n in nodes_orm
    ]
    edges = [
        MnemoGraphEdge(
            from_id=e.from_node_id,
            to_id=e.to_node_id,
            edge_type=e.edge_type,
            weight=float(e.weight or 0.5),
        )
        for e in edges_orm
    ]
    return MnemoGraphResponse(member_id=member_id, nodes=nodes, edges=edges)


@router.post("/search", response_model=MemorySearchResponse)
async def search_memories(
    search_request: MemorySearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """语义搜索记忆（基于向量检索）。固定路径须排在 /{memory_id} 之前，避免旧版路由匹配异常。"""
    try:
        vector_service = VectorService()
        raw = await vector_service.search_memories(
            query=search_request.query,
            user_id=current_user.id,
            archive_id=search_request.archive_id,
            member_id=search_request.member_id,
            limit=search_request.limit,
        )
        mem_ids: list[int] = []
        for item in raw:
            pl = item.get("payload") if isinstance(item, dict) else None
            if not isinstance(pl, dict):
                continue
            mid = pl.get("memory_id")
            if mid is not None:
                try:
                    mem_ids.append(int(mid))
                except (TypeError, ValueError):
                    pass
        if not mem_ids:
            return MemorySearchResponse(results=[], query=search_request.query, total=0)
        stmt = (
            select(Memory)
            .options(_MEMORY_MEMBER_ARCHIVE)
            .join(Member, Memory.member_id == Member.id)
            .join(Archive, Member.archive_id == Archive.id)
            .where(Memory.id.in_(mem_ids), Archive.owner_id == current_user.id)
        )
        rows = (await db.execute(stmt)).scalars().all()
        by_id = {m.id: m for m in rows}
        ordered = [by_id[i] for i in mem_ids if i in by_id]
        return MemorySearchResponse(
            results=[memory_to_response(m) for m in ordered],
            query=search_request.query,
            total=len(ordered),
        )
    except Exception as e:
        raise DomainInternalError(error_code="INTERNAL_SERVER_ERROR", message=f"搜索失败: {str(e)}")


@router.post("", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED)
async def create_memory(
    memory_data: MemoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建新的记忆条目"""
    result = await db.execute(
        select(Member).where(Member.id == memory_data.member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="成员不存在")

    result = await db.execute(
        select(Archive).where(Archive.id == member.archive_id, Archive.owner_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise DomainAuthError(error_code="AUTH_FORBIDDEN", message="无权限在此档案下创建记忆")

    memory = Memory(
        title=memory_data.title,
        content_text=memory_data.content_text,
        member_id=memory_data.member_id,
        timestamp=memory_data.timestamp or datetime.now(timezone.utc),
        location=memory_data.location,
        emotion_label=memory_data.emotion_label,
    )
    db.add(memory)
    await db.commit()
    await db.refresh(memory)
    try:
        await ensure_memory_engram(db, memory, current_user.id)
    except Exception as exc:
        logger.warning("记忆入 Engram 图失败（可稍后由对话预热补全）: %s", exc)

    a_row = await db.execute(select(Archive).where(Archive.id == member.archive_id))
    archive_for_name = a_row.scalar_one_or_none()
    archive_display_name = archive_for_name.name if archive_for_name else None

    return MemoryResponse(
        id=memory.id,
        title=memory.title,
        content_text=memory.content_text,
        timestamp=memory.timestamp,
        location=memory.location,
        member_id=memory.member_id,
        archive_id=member.archive_id,
        member_name=member.name,
        archive_name=archive_display_name,
        emotion_label=memory.emotion_label,
        vector_embedding_id=memory.vector_embedding_id,
        is_capsule=memory.is_capsule,
        unlock_date=memory.unlock_date,
        media_refs=list(memory.media_refs) if memory.media_refs is not None else [],
        created_at=memory.created_at,
        updated_at=memory.updated_at,
    )


@router.get("", response_model=list[MemoryResponse])
async def list_memories(
    archive_id: int | None = None,
    member_id: int | None = None,
    emotion_label: str | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取记忆列表（支持按档案/成员/情绪筛选）"""
    query = (
        select(Memory)
        .options(_MEMORY_MEMBER_ARCHIVE)
        .join(Member, Memory.member_id == Member.id)
        .join(Archive, Member.archive_id == Archive.id)
        .where(Archive.owner_id == current_user.id)
    )
    if archive_id:
        query = query.where(Member.archive_id == archive_id)
    if member_id:
        query = query.where(Memory.member_id == member_id)
    if emotion_label:
        query = query.where(Memory.emotion_label == emotion_label)

    query = query.order_by(Memory.timestamp.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    memories = result.scalars().all()
    return [memory_to_response(m) for m in memories]


@router.post("/batch-delete", response_model=MemoryBatchDeleteResponse)
async def batch_delete_memories(
    body: MemoryBatchDeleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """批量删除记忆（单事务）。"""
    unique_ids = list(dict.fromkeys(body.memory_ids))
    q = (
        select(Memory.id)
        .join(Member, Memory.member_id == Member.id)
        .join(Archive, Member.archive_id == Archive.id)
        .where(Memory.id.in_(unique_ids), Archive.owner_id == current_user.id)
    )
    if body.member_id is not None:
        q = q.where(Memory.member_id == body.member_id)
    result = await db.execute(q)
    found = [row[0] for row in result.all()]
    if len(found) != len(unique_ids):
        raise DomainResourceError(
            error_code="RESOURCE_NOT_FOUND",
            message="部分记忆不存在、不属于该成员或无权删除，请刷新后重试",
        )
    await _delete_engram_event_nodes_for_memories(db, current_user.id, found)
    await db.execute(delete(Memory).where(Memory.id.in_(found)))
    await db.commit()
    return MemoryBatchDeleteResponse(deleted_count=len(found))


@router.get("/{memory_id}", response_model=MemoryResponse)
async def get_memory(
    memory_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取单条记忆详情"""
    result = await db.execute(
        select(Memory)
        .options(_MEMORY_MEMBER_ARCHIVE)
        .join(Member, Memory.member_id == Member.id)
        .join(Archive, Member.archive_id == Archive.id)
        .where(Memory.id == memory_id, Archive.owner_id == current_user.id)
    )
    memory = result.scalar_one_or_none()
    if not memory:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="记忆不存在")
    return memory_to_response(memory)


@router.patch("/{memory_id}", response_model=MemoryResponse)
async def update_memory(
    memory_id: int,
    update_data: MemoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新记忆条目"""
    result = await db.execute(
        select(Memory)
        .options(_MEMORY_MEMBER_ARCHIVE)
        .join(Member, Memory.member_id == Member.id)
        .join(Archive, Member.archive_id == Archive.id)
        .where(Memory.id == memory_id, Archive.owner_id == current_user.id)
    )
    memory = result.scalar_one_or_none()
    if not memory:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="记忆不存在")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(memory, field, value)

    memory.updated_at = datetime.now(timezone.utc)
    await db.commit()

    res2 = await db.execute(
        select(Memory)
        .options(_MEMORY_MEMBER_ARCHIVE)
        .join(Member, Memory.member_id == Member.id)
        .join(Archive, Member.archive_id == Archive.id)
        .where(Memory.id == memory_id, Archive.owner_id == current_user.id)
    )
    memory2 = res2.scalar_one_or_none()
    if not memory2:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="记忆不存在")
    return memory_to_response(memory2)


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory(
    memory_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除记忆条目"""
    result = await db.execute(
        select(Memory)
        .join(Member, Memory.member_id == Member.id)
        .join(Archive, Member.archive_id == Archive.id)
        .where(Memory.id == memory_id, Archive.owner_id == current_user.id)
    )
    memory = result.scalar_one_or_none()
    if not memory:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="记忆不存在")

    await _delete_engram_event_nodes_for_memories(db, current_user.id, [memory.id])
    await db.delete(memory)
    await db.commit()
