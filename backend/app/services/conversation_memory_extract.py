"""从多轮对话文本中提炼记忆条目并入库（含链式关系）。"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.memory import Memory
from app.mnemo.sync_memories import ensure_memory_engram
from app.mnemo.chain_enricher import (
    link_temporal_chain,
    llm_enrich_cross_links,
    sort_memories_by_time,
)
from app.services.llm_service import LLMService

logger = logging.getLogger(__name__)


async def _apply_extract_links(
    session: AsyncSession,
    user_id: int,
    memories: list[Memory],
    links: list[Any],
) -> int:
    from sqlalchemy import select
    from app.models.engram import EngramEdge
    from app.mnemo.graph_sql import SqlAlchemyGraphManager
    from app.mnemo.chain_enricher import _engram_id_for_memory

    graph = SqlAlchemyGraphManager(session, user_id)
    added = 0
    for item in links[:16]:
        if not isinstance(item, dict):
            continue
        try:
            fi = int(item["from"])
            ti = int(item["to"])
        except (KeyError, TypeError, ValueError):
            continue
        if fi == ti or min(fi, ti) < 0 or max(fi, ti) >= len(memories):
            continue
        rel = str(item.get("relation", "RELATED_TO")).upper().replace("-", "_")
        if rel not in {"RELATED_TO", "CAUSED_BY", "EMOTIONALLY_LINKED", "SUPPORTS"}:
            rel = "RELATED_TO"
        ea = await _engram_id_for_memory(session, user_id, memories[fi].id)
        eb = await _engram_id_for_memory(session, user_id, memories[ti].id)
        if not ea or not eb:
            continue
        er = await session.execute(
            select(EngramEdge).where(
                EngramEdge.from_node_id == ea,
                EngramEdge.to_node_id == eb,
                EngramEdge.edge_type == rel,
            )
        )
        if er.scalar_one_or_none():
            continue
        await graph.create_edge(ea, eb, rel, weight=float(item.get("weight", 0.62)))
        added += 1
    return added


async def extract_and_save_memories(
    session: AsyncSession,
    *,
    user_id: int,
    member_id: int,
    messages: list[dict[str, Any]],
    llm: LLMService,
    build_graph: bool = True,
) -> tuple[list[Memory], dict[str, int]]:
    """
    messages: [{"role":"user"|"assistant","content":"..."}, ...]
    返回新建 Memory 列表与图统计。
    """
    lines: list[str] = []
    for m in messages[-30:]:
        role = str(m.get("role", ""))
        content = str(m.get("content", "")).strip()
        if not content:
            continue
        who = "用户" if role == "user" else "AI"
        lines.append(f"{who}: {content[:2000]}")
    transcript = "\n".join(lines)
    if len(transcript) < 8:
        return [], {"temporal_edges": 0, "llm_edges": 0}

    prompt = f"""你是关系档案助手。从下列对话中提炼 1～8 条**可独立保存的记忆**（具体事件、约定、情感时刻、共同回忆），JSON：
{{
  "memories": [
    {{"title": "短语标题", "content_text": "第三人称客观叙述，可含时间地点", "emotion_label": "温暖|感伤|快乐|平静|自豪|感激|怀念|愧疚|安心|坚韧|空字符串"}}
  ],
  "links": [{{"from": 0, "to": 1, "relation": "RELATED_TO"}}]
}}
要求：
- 不要虚构对话里没有的信息；可合并同类表述为一条。
- emotion_label 没有把握时填空字符串。
- links 可选，表示所提炼条目之间的关联；relation 取 RELATED_TO | CAUSED_BY | EMOTIONALLY_LINKED 之一。
- from/to 为 memories 数组下标。

对话：
{transcript[:24000]}
"""
    try:
        data = await llm.json_complete(prompt, temperature=0.2)
    except Exception as exc:
        logger.warning("对话提炼记忆 LLM 失败: %s", exc)
        return [], {"temporal_edges": 0, "llm_edges": 0}

    mem_list = data.get("memories") if isinstance(data, dict) else None
    if not isinstance(mem_list, list) or not mem_list:
        return [], {"temporal_edges": 0, "llm_edges": 0}

    links_raw = data.get("links") if isinstance(data, dict) else None
    if not isinstance(links_raw, list):
        links_raw = []

    created: list[Memory] = []
    now = datetime.now(timezone.utc)
    for item in mem_list[:12]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        body = str(item.get("content_text", "")).strip()
        if len(title) < 1 or len(body) < 2:
            continue
        emo = str(item.get("emotion_label", "")).strip() or None
        memory = Memory(
            title=title[:200],
            content_text=body[:20000],
            member_id=member_id,
            timestamp=now,
            emotion_label=emo,
        )
        session.add(memory)
        await session.flush()
        created.append(memory)

    for m in created:
        try:
            await ensure_memory_engram(session, m, user_id)
        except Exception as exc:
            logger.debug("engram sync: %s", exc)

    if not created:
        return [], {"temporal_edges": 0, "llm_edges": 0}

    ordered = sort_memories_by_time(created)
    stats = {"temporal_edges": 0, "llm_edges": 0}
    if build_graph and len(ordered) >= 2:
        stats["temporal_edges"] = await link_temporal_chain(session, user_id, ordered)
        stats["llm_edges"] = await _apply_extract_links(session, user_id, ordered, links_raw)
        if llm is not None:
            stats["llm_edges"] += await llm_enrich_cross_links(session, user_id, ordered, llm)

    return created, stats
