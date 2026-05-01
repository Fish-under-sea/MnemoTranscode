"""
导入或批量创建记忆后，构建链式关系网：时间相邻链 + LLM 推理因果/关联边。
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.memory import Memory
from app.models.engram import EngramNode, EngramEdge
from app.mnemo.graph_sql import SqlAlchemyGraphManager
from app.services.llm_service import LLMService

logger = logging.getLogger(__name__)


def _catalog_indices(n: int, cap: int) -> list[int]:
    """在长列表上均匀取 cap 个下标，避免构图时只看得到前若干条记忆。"""
    if n <= 0:
        return []
    if n <= cap:
        return list(range(n))
    denom = cap - 1
    return [min(n - 1, (i * (n - 1)) // denom) for i in range(cap)]


async def _engram_id_for_memory(session: AsyncSession, user_id: int, memory_id: int) -> str | None:
    r = await session.execute(
        select(EngramNode.id).where(
            EngramNode.user_id == user_id,
            EngramNode.memory_id == memory_id,
            EngramNode.is_deprecated.is_(False),
        )
    )
    row = r.first()
    return row[0] if row else None


async def link_temporal_chain(
    session: AsyncSession,
    user_id: int,
    memories_ordered: list[Memory],
) -> int:
    """按列表顺序在相邻记忆的 Engram 间建 TEMPORAL_NEXT（已存在则跳过）。"""
    if len(memories_ordered) < 2:
        return 0
    mids = [m.id for m in memories_ordered]
    er_map = await session.execute(
        select(EngramNode.memory_id, EngramNode.id).where(
            EngramNode.user_id == user_id,
            EngramNode.memory_id.in_(mids),
            EngramNode.is_deprecated.is_(False),
        )
    )
    mid_to_eid: dict[int, str] = {int(row[0]): str(row[1]) for row in er_map.all() if row[0] is not None}
    graph = SqlAlchemyGraphManager(session, user_id)
    added = 0
    for i in range(len(memories_ordered) - 1):
        a = mid_to_eid.get(memories_ordered[i].id)
        b = mid_to_eid.get(memories_ordered[i + 1].id)
        if not a or not b:
            continue
        er = await session.execute(
            select(EngramEdge).where(
                EngramEdge.from_node_id == a,
                EngramEdge.to_node_id == b,
                EngramEdge.edge_type == "TEMPORAL_NEXT",
            )
        )
        if er.scalar_one_or_none() is not None:
            continue
        await graph.create_edge(a, b, "TEMPORAL_NEXT", weight=0.55)
        added += 1
    return added


async def llm_enrich_cross_links(
    session: AsyncSession,
    user_id: int,
    memories: list[Memory],
    llm: LLMService,
    *,
    catalog_cap: int = 56,
    max_pairs: int = 28,
    strict_llm: bool = False,
) -> int:
    """LLM 在非相邻记忆间建议 RELATED_TO / CAUSED_BY 等边（indices 对应列表下标）。"""
    n = len(memories)
    if n < 2:
        return 0
    idxs = _catalog_indices(n, min(catalog_cap, n))
    lines: list[str] = []
    for idx in idxs:
        m = memories[idx]
        snippet = (m.content_text or "")[:320].replace("\n", " ")
        lines.append(f"[{idx}] {m.title}: {snippet}")
    catalog = "\n".join(lines)
    upper = n - 1
    prompt = f"""以下是同一人物（关系档案中的 Ta）的多条记忆摘要；方括号内数字为**全局下标**（0..{upper}），列表为抽样展示但关联可涉及任意下标。
请推断哪些条目之间存在**叙事关联**（因果、情感共鸣、主题呼应、前后铺垫），输出 JSON：
{{
  "links": [
    {{"from_index": 0, "to_index": 2, "relation": "RELATED_TO", "weight": 0.75, "note": "简短理由"}}
  ]
}}
要求：
- 至少 0 条、最多 {max_pairs} 条；只输出确有依据的关联，禁编造事实。
- relation 必须是以下之一：RELATED_TO, CAUSED_BY, EMOTIONALLY_LINKED, SUPPORTS
- from_index 与 to_index 必须在 0..{upper} 之间，且 from_index != to_index

记忆列表（抽样，下标全局有效）：
{catalog}
"""
    try:
        data = await llm.json_complete(
            prompt,
            temperature=0.15,
            timeout=120.0,
            max_tokens=min(8192, max(2048, llm.max_tokens)),
        )
    except Exception as exc:
        logger.warning("LLM 构图失败: %s", exc)
        if strict_llm:
            raise
        return 0
    links = data.get("links") if isinstance(data, dict) else None
    if not isinstance(links, list):
        if strict_llm:
            raise ValueError("LLM 构图返回的 JSON 缺少 links 数组或类型错误")
        return 0

    graph = SqlAlchemyGraphManager(session, user_id)
    added = 0
    for item in links[:max_pairs]:
        if not isinstance(item, dict):
            continue
        try:
            fi = int(item["from_index"])
            ti = int(item["to_index"])
        except (KeyError, TypeError, ValueError):
            continue
        if fi == ti or fi < 0 or ti < 0 or fi >= len(memories) or ti >= len(memories):
            continue
        rel = str(item.get("relation", "RELATED_TO")).upper().replace("-", "_")
        if rel not in {"RELATED_TO", "CAUSED_BY", "EMOTIONALLY_LINKED", "SUPPORTS"}:
            rel = "RELATED_TO"
        w = float(item.get("weight", 0.65))
        w = max(0.2, min(1.0, w))
        mid_a = memories[fi].id
        mid_b = memories[ti].id
        ea = await _engram_id_for_memory(session, user_id, mid_a)
        eb = await _engram_id_for_memory(session, user_id, mid_b)
        if not ea or not eb:
            continue
        er = await session.execute(
            select(EngramEdge).where(
                EngramEdge.from_node_id == ea,
                EngramEdge.to_node_id == eb,
                EngramEdge.edge_type == rel,
            )
        )
        if er.scalar_one_or_none() is not None:
            continue
        meta = {"note": str(item.get("note", ""))[:500]}
        await graph.create_edge(ea, eb, rel, weight=w, metadata=meta)
        added += 1
    return added


def _memory_sort_key(m: Memory) -> datetime:
    if m.timestamp is not None:
        return m.timestamp
    if m.created_at is not None:
        return m.created_at
    return datetime.min.replace(tzinfo=timezone.utc)


def sort_memories_by_time(memories: list[Memory]) -> list[Memory]:
    return sorted(memories, key=_memory_sort_key)


async def enrich_after_memories_created(
    session: AsyncSession,
    user_id: int,
    created: list[Memory],
    llm: LLMService | None,
    *,
    strict_llm: bool = False,
) -> dict[str, int]:
    """排序后建时间链，可选 LLM 横连。"""
    if not created:
        return {"temporal_edges": 0, "llm_edges": 0}
    ordered = sort_memories_by_time(created)
    t = await link_temporal_chain(session, user_id, ordered)
    llm_n = 0
    if llm is not None and len(ordered) >= 2:
        llm_n = await llm_enrich_cross_links(
            session, user_id, ordered, llm, strict_llm=strict_llm
        )
    return {"temporal_edges": t, "llm_edges": llm_n}
