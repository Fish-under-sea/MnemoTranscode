# 睡眠固化：情节合并、抽象、冲突、边强化、陈旧衰减（对齐 Core Pack 五步语义）

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, NamedTuple

from sqlalchemy import select

from app.models.engram import EngramNode, EngramEdge
from app.mnemo.graph_sql import SqlAlchemyGraphManager

logger = logging.getLogger(__name__)


class ConflictResolution(str, Enum):
    KEEP_NEW = "keep_new"
    KEEP_OLD = "keep_old"
    EVOLVE = "evolve"
    COEXIST = "coexist"


class ConflictPair(NamedTuple):
    node_a_id: str
    node_b_id: str
    conflict_type: str
    similarity: float


async def detect_conflicts(
    graph: SqlAlchemyGraphManager,
    new_node_ids: list[str],
    similarity_threshold: float = 0.82,
) -> list[ConflictPair]:
    conflicts: list[ConflictPair] = []
    for node_id in new_node_ids:
        edges = await graph.get_edges(node_id, edge_type="CONTRADICTS")
        for edge in edges:
            conflicts.append(
                ConflictPair(
                    node_a_id=node_id,
                    node_b_id=edge["target_id"],
                    conflict_type=str(edge.get("conflict_type", "factual")),
                    similarity=float(edge.get("similarity", 0.9)),
                )
            )
    return conflicts


CONFLICT_RESOLUTION_PROMPT = """
你是一个记忆仲裁者。以下是同一段关系叙事中两条可能冲突的陈述：
记忆 A（较早）：{node_a_content}
记忆 B（较新）：{node_b_content}
请判断：1. 是否真正矛盾，还是随时间演化？2. 应保留哪一条或共存？
只输出 JSON：{{"resolution": "keep_new|keep_old|evolve|coexist", "reason": "简短中文"}}
""".strip()


async def rewrite_conflict(
    graph: SqlAlchemyGraphManager,
    llm_client: Any,
    conflict: ConflictPair,
) -> ConflictResolution:
    node_a = await graph.get_node(conflict.node_a_id)
    node_b = await graph.get_node(conflict.node_b_id)
    prompt = CONFLICT_RESOLUTION_PROMPT.format(
        node_a_content=node_a.get("content", ""),
        node_b_content=node_b.get("content", ""),
    )
    verdict = await llm_client.json_complete(prompt)
    res_raw = str(verdict.get("resolution", "coexist")).lower().replace("-", "_")
    try:
        resolution = ConflictResolution(res_raw)
    except ValueError:
        resolution = ConflictResolution.COEXIST

    reason = str(verdict.get("reason", ""))
    match resolution:
        case ConflictResolution.KEEP_NEW:
            await graph.deprecate_node(conflict.node_a_id, reason=reason)
        case ConflictResolution.KEEP_OLD:
            await graph.deprecate_node(conflict.node_b_id, reason=reason)
        case ConflictResolution.EVOLVE:
            await graph.create_edge(
                conflict.node_a_id,
                conflict.node_b_id,
                "EVOLVED_FROM",
                weight=0.7,
                metadata={"reason": reason},
            )
        case ConflictResolution.COEXIST:
            pass
    return resolution


class SleepConsolidator:
    """后台固化 pipeline（可由 Celery 定时触发）。"""

    def __init__(
        self,
        graph: SqlAlchemyGraphManager,
        llm_client: Any,
        *,
        decay_threshold: float = 0.1,
        stale_days: int = 90,
    ) -> None:
        self.graph = graph
        self.llm = llm_client
        self.decay_threshold = decay_threshold
        self.stale_days = stale_days

    async def run_consolidation(self, *, window_hours: float = 1.0) -> dict[str, int]:
        logger.info("SleepConsolidator 开始一轮固化 window=%sh", window_hours)
        stats: dict[str, int] = {
            "merged_episodes": 0,
            "abstracted_facts": 0,
            "conflicts_resolved": 0,
            "reinforced_edges": 0,
            "decayed_nodes": 0,
        }
        stats["merged_episodes"] = await self._merge_episodes(window_hours=window_hours)
        stats["abstracted_facts"] = await self._abstract_semantics()
        recent_ids = await self.graph.get_recent_nodes(hours=max(window_hours, 0.5))
        conflicts = await detect_conflicts(self.graph, recent_ids)
        for c in conflicts:
            try:
                await rewrite_conflict(self.graph, self.llm, c)
                stats["conflicts_resolved"] += 1
            except Exception as exc:
                logger.warning("冲突裁决失败: %s", exc)
        stats["reinforced_edges"] = await self._reinforce_coactivated()
        stats["decayed_nodes"] = await self._decay_stale()
        logger.info("SleepConsolidator 完成: %s", stats)
        return stats

    async def _merge_episodes(self, window_hours: float) -> int:
        """时间窗内、同城成员、文本前缀相近的 Event 合并摘要节点。"""
        since = datetime.now(timezone.utc) - timedelta(hours=window_hours)
        r = await self.graph.session.execute(
            select(EngramNode).where(
                EngramNode.user_id == self.graph.user_id,
                EngramNode.node_type == "Event",
                EngramNode.is_deprecated.is_(False),
                EngramNode.created_at >= since,
            )
        )
        events = list(r.scalars().all())
        if len(events) < 2:
            return 0

        merged = 0
        by_bucket: dict[tuple[int | None, str], list[EngramNode]] = {}
        for ev in events:
            key = (ev.member_id, (ev.content or "")[:40])
            by_bucket.setdefault(key, []).append(ev)

        for group in by_bucket.values():
            if len(group) < 2:
                continue
            group.sort(key=lambda x: x.created_at or datetime.min.replace(tzinfo=timezone.utc))
            anchor = group[0]
            combined = "\n".join(f"- {g.content[:200]}" for g in group)
            summary_content = f"【合并情节】\n{combined}"[:4000]
            try:
                new_id = await self.graph.create_node(
                    "SemanticFact",
                    summary_content,
                    member_id=anchor.member_id,
                    importance=0.55,
                )
                for g in group[1:]:
                    await self.graph.create_edge(g.id, new_id, "EVOLVED_FROM", weight=0.6)
                    await self.graph.deprecate_node(g.id, reason="merged_episode")
                merged += len(group) - 1
            except Exception as exc:
                logger.debug("情节合并跳过: %s", exc)
        return merged

    async def _abstract_semantics(self) -> int:
        """从近期 Event 抽取 Belief 节点（一次 LLM 调用尽量批处理小批量）。"""
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        r = await self.graph.session.execute(
            select(EngramNode).where(
                EngramNode.user_id == self.graph.user_id,
                EngramNode.node_type == "Event",
                EngramNode.is_deprecated.is_(False),
                EngramNode.created_at >= since,
            )
            .limit(8)
        )
        events = list(r.scalars().all())
        if not events:
            return 0
        combined = "\n".join(f"{i+1}. {e.content[:300]}" for i, e in enumerate(events))
        prompt = f"""从下列情节中提炼 1~3 条简短「信念/态度」陈述（中文名词短语），JSON 格式：
{{"beliefs": ["...", "..."]}}
情节：
{combined}
"""
        try:
            data = await self.llm.json_complete(prompt)
        except Exception as exc:
            logger.warning("抽象语义 LLM 失败: %s", exc)
            return 0
        beliefs = data.get("beliefs") if isinstance(data, dict) else None
        if not isinstance(beliefs, list):
            return 0
        count = 0
        for b in beliefs[:3]:
            text = str(b).strip()
            if len(text) < 2:
                continue
            bid = await self.graph.create_node("Belief", text, member_id=events[0].member_id, importance=0.5)
            await self.graph.create_edge(events[0].id, bid, "SUPPORTS", weight=0.5)
            count += 1
        return count

    async def _reinforce_coactivated(self) -> int:
        r = await self.graph.session.execute(
            select(EngramEdge)
            .join(EngramNode, EngramEdge.from_node_id == EngramNode.id)
            .where(
                EngramEdge.edge_type == "COACTIVATED_WITH",
                EngramEdge.coactivation_count > 0,
                EngramNode.user_id == self.graph.user_id,
            )
        )
        edges = r.scalars().all()
        n = 0
        for e in edges:
            nw = min(1.0, float(e.weight) + 0.01 * min(int(e.coactivation_count), 5))
            if nw > float(e.weight):
                e.weight = nw
                n += 1
        await self.graph.session.flush()
        return n

    async def _decay_stale(self) -> int:
        cutoff = datetime.now(timezone.utc) - timedelta(days=self.stale_days)
        r = await self.graph.session.execute(
            select(EngramNode).where(
                EngramNode.user_id == self.graph.user_id,
                EngramNode.is_deprecated.is_(False),
                EngramNode.last_access < cutoff,
            )
        )
        nodes = r.scalars().all()
        decayed = 0
        for n in nodes:
            new_e = float(n.activation_energy) * 0.9
            n.activation_energy = new_e
            decayed += 1
            if new_e < self.decay_threshold:
                n.is_deprecated = True
                n.deprecation_reason = "stale_decay"
        await self.graph.session.flush()
        return decayed
