# 将业务 Memory / Member 同步为 Engram 图节点（懒加载 + 幂等）

from __future__ import annotations

import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.memory import Memory, Member, Archive
from app.models.engram import EngramNode
from app.mnemo.graph_sql import SqlAlchemyGraphManager

logger = logging.getLogger(__name__)


async def _get_person_engram_id(session: AsyncSession, graph: SqlAlchemyGraphManager, member: Member) -> str:
    r = await session.execute(
        select(EngramNode.id).where(
            EngramNode.user_id == graph.user_id,
            EngramNode.member_id == member.id,
            EngramNode.node_type == "Person",
            EngramNode.is_deprecated.is_(False),
        )
    )
    row = r.first()
    if row:
        return row[0]
    bio = (member.bio or "")[:1500]
    content = f"{member.name}\n{bio}".strip() or member.name
    return await graph.create_node(
        "Person",
        content,
        member_id=member.id,
        importance=0.95,
        activation_energy=0.9,
    )


async def ensure_member_person_anchor(
    session: AsyncSession,
    member: Member,
    user_id: int,
) -> str:
    """保证成员对应 Person 节点存在（无记忆时对话也能从锚点扩散）。"""
    graph = SqlAlchemyGraphManager(session, user_id)
    return await _get_person_engram_id(session, graph, member)


async def ensure_memory_engram(
    session: AsyncSession,
    memory: Memory,
    user_id: int,
    *,
    with_vector: bool = True,
) -> str | None:
    """单条 Memory 对应一个 Event Engram；已存在则返回已有 id。"""
    r = await session.execute(
        select(EngramNode).where(
            EngramNode.user_id == user_id,
            EngramNode.memory_id == memory.id,
            EngramNode.is_deprecated.is_(False),
        )
    )
    existing = r.scalar_one_or_none()
    if existing:
        # 大批量导入可能跳过向量；后续对话/bootstrap 需补齐
        if with_vector and not memory.vector_embedding_id:
            try:
                from app.services.vector_service import VectorService

                title = memory.title or ""
                body = memory.content_text or ""
                embed_text = f"{title}\n{body}".strip()[:4000]
                vs = VectorService()
                vid = await vs.upsert_memory(
                    memory.id,
                    user_id,
                    embed_text,
                    engram_id=existing.id,
                    member_id=memory.member_id,
                    point_id=existing.id,
                )
                memory.vector_embedding_id = vid
            except Exception as exc:
                logger.debug("已有 Engram 补写向量跳过: %s", exc)
        return existing.id

    result = await session.execute(
        select(Member)
        .options(selectinload(Member.archive))
        .join(Archive, Member.archive_id == Archive.id)
        .where(Member.id == memory.member_id, Archive.owner_id == user_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        return None

    graph = SqlAlchemyGraphManager(session, user_id)
    person_id = await _get_person_engram_id(session, graph, member)

    title = memory.title or ""
    body = memory.content_text or ""
    emotion = memory.emotion_label or ""
    content = f"{title}\n{body}".strip()[:8000]
    ev_id = await graph.create_node(
        "Event",
        content,
        member_id=member.id,
        memory_id=memory.id,
        importance=0.65,
        activation_energy=0.6,
    )
    await graph.create_edge(ev_id, person_id, "RELATED_TO", weight=0.85)
    if emotion:
        # 必须与 memory_id 绑定，否则删记忆后 Emotion 成孤儿结点，关系网无法「跟着清空」
        em_id = await graph.create_node(
            "Emotion",
            emotion,
            member_id=member.id,
            memory_id=memory.id,
            importance=0.4,
        )
        await graph.create_edge(ev_id, em_id, "EMOTIONALLY_LINKED", weight=0.7)

    if with_vector:
        try:
            from app.services.vector_service import VectorService

            vs = VectorService()
            embed_text = f"{title}\n{body}".strip()[:4000]
            vid = await vs.upsert_memory(
                memory.id,
                user_id,
                embed_text,
                engram_id=ev_id,
                member_id=memory.member_id,
                point_id=ev_id,
            )
            if not memory.vector_embedding_id:
                memory.vector_embedding_id = vid
        except Exception as exc:
            logger.debug("engram Qdrant 写入跳过: %s", exc)

    return ev_id


async def bootstrap_member_engrams(session: AsyncSession, member_id: int, user_id: int) -> None:
    """对话前预热：把该成员下尚未入图的 Memory 全部挂载到 Engram。"""
    r = await session.execute(
        select(Memory)
        .join(Member, Memory.member_id == Member.id)
        .join(Archive, Member.archive_id == Archive.id)
        .where(Member.id == member_id, Archive.owner_id == user_id)
        .order_by(Memory.timestamp.desc())
        .limit(200)
    )
    for mem in r.scalars().all():
        try:
            await ensure_memory_engram(session, mem, user_id)
        except Exception as exc:
            logger.warning("bootstrap 记忆入图失败 memory_id=%s: %s", mem.id, exc)
