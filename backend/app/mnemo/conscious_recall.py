# 意识流组装：Self Core + 激活簇 → system prompt 扩展段

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, TYPE_CHECKING

from app.mnemo.activation_engine import ActivationEngine, ActivationCluster
from app.mnemo.graph_sql import SqlAlchemyGraphManager

if TYPE_CHECKING:
    from app.services.vector_service import VectorService

logger = logging.getLogger(__name__)


@dataclass
class SelfCore:
    """人格连续性核心——始终参与 prompt 组装"""

    name: str
    core_values: list[str]
    belief_summary: str
    goal_stack: list[str]
    emotional_baseline: str
    long_term_interests: list[str]


@dataclass
class ConsciousContext:
    """一次意识召回的完整上下文"""

    self_core: SelfCore
    activated_cluster: ActivationCluster
    recent_turns: list[dict]
    dominant_emotion: str | None
    narrative_thread: str | None


def self_core_from_member(member) -> SelfCore:
    """从 ORM Member 构造 SelfCore；mnemo_self_core JSON 可覆盖字段。"""
    raw = getattr(member, "mnemo_self_core", None) or {}
    return SelfCore(
        name=member.name,
        core_values=list(raw.get("core_values") or ["真诚", "有温度", "对自己诚实"]),
        belief_summary=str(raw.get("belief_summary") or "我相信记忆能连接彼此。"),
        goal_stack=list(raw.get("goal_stack") or ["守护这段关系的点滴"]),
        emotional_baseline=str(raw.get("emotional_baseline") or "平静"),
        long_term_interests=list(raw.get("long_term_interests") or ["倾听", "回忆", "陪伴"]),
    )


class ConsciousRecall:
    """扩散激活 + 意识流文本组装。"""

    def __init__(
        self,
        graph: SqlAlchemyGraphManager,
        activation_engine: ActivationEngine,
        vector: VectorService | None,
        *,
        user_id: int,
        member_id: int,
        embedding_api_key: str | None = None,
        embedding_base_url: str | None = None,
        max_memories_in_prompt: int = 6,
        max_recent_turns: int = 4,
    ) -> None:
        self.graph = graph
        self.engine = activation_engine
        self.vector = vector
        self.user_id = user_id
        self.member_id = member_id
        self.embedding_api_key = embedding_api_key
        self.embedding_base_url = embedding_base_url
        self.max_memories = max_memories_in_prompt
        self.max_turns = max_recent_turns

    async def recall(
        self,
        query: str,
        self_core: SelfCore,
        recent_turns: list[dict],
    ) -> ConsciousContext:
        seed_ids = await self._find_seeds(query, top_k=3)
        if not seed_ids:
            seed_ids = await self._sql_fallback_seeds()

        cluster = await self.engine.activate(query, seed_ids)
        emotion_nodes = cluster.by_type("Emotion")
        dominant = None
        if emotion_nodes:
            raw = emotion_nodes[0].raw_content
            dominant = (
                raw.get("label")
                or raw.get("emotion_label")
                or raw.get("content")
            )

        narrative = None
        if len(cluster.activated) >= 3:
            narrative = await self._extract_narrative_thread(cluster, self_core)

        return ConsciousContext(
            self_core=self_core,
            activated_cluster=cluster,
            recent_turns=recent_turns[-self.max_turns :],
            dominant_emotion=dominant,
            narrative_thread=narrative,
        )

    async def assemble_system_extension(self, ctx: ConsciousContext) -> str:
        """拼入 system prompt 的「意识前置流」扩展（不含基础角色段）。"""
        sc = ctx.self_core
        memories = ctx.activated_cluster.top(self.max_memories)
        memory_lines: list[str] = []
        for m in memories:
            content = str(m.raw_content.get("content", ""))[:800]
            energy_bar = "█" * int(m.energy * 5) + "░" * (5 - int(m.energy * 5))
            memory_lines.append(f"  [{m.node_type}|{energy_bar}] {content}")

        memories_block = "\n".join(memory_lines) if memory_lines else "  （暂无强烈激活记忆）"
        narrative_line = ctx.narrative_thread or "（无明显叙事主线）"
        emotion_line = ctx.dominant_emotion or "（情绪平稳）"

        return f"""
=== 意识前置流（内在联想结果）===
[人格核心]
我是 {sc.name}。核心价值观：{", ".join(sc.core_values)}。
当前情绪基调：{sc.emotional_baseline}。
当前目标：{sc.goal_stack[0] if sc.goal_stack else "无明确目标"}。

[世界观]
{sc.belief_summary}

[长期兴趣]
{", ".join(sc.long_term_interests)}

[激活记忆簇]（按联想强度排序）
{memories_block}

[叙事主线]
{narrative_line}

[情绪色彩]
{emotion_line}
=== 以上为背景，请自然延续对话，不要复述本段标题 ===
""".strip()

    async def _find_seeds(self, query: str, top_k: int = 3) -> list[str]:
        if self.vector is None:
            return []
        try:
            hits = await self.vector.search_engram_seeds(
                query=query,
                user_id=self.user_id,
                member_id=self.member_id,
                limit=top_k,
                api_key=self.embedding_api_key,
                base_url=self.embedding_base_url,
            )
            return [h for h in hits if h]
        except Exception as exc:
            logger.warning("向量种子召回失败，将使用 SQL 回退: %s", exc)
            return []

    async def _sql_fallback_seeds(self) -> list[str]:
        from sqlalchemy import select
        from app.models.engram import EngramNode

        r = await self.graph.session.execute(
            select(EngramNode.id)
            .where(
                EngramNode.user_id == self.user_id,
                EngramNode.member_id == self.member_id,
                EngramNode.is_deprecated.is_(False),
            )
            .order_by(EngramNode.last_access.desc())
            .limit(5)
        )
        ids = [row[0] for row in r.all()]
        if ids:
            return ids
        r2 = await self.graph.session.execute(
            select(EngramNode.id)
            .where(
                EngramNode.user_id == self.user_id,
                EngramNode.member_id == self.member_id,
                EngramNode.node_type == "Person",
                EngramNode.is_deprecated.is_(False),
            )
            .limit(1)
        )
        row2 = r2.first()
        return [row2[0]] if row2 else []

    async def _extract_narrative_thread(self, cluster: ActivationCluster, self_core: SelfCore) -> str | None:
        """沿 CAUSED_BY / EVOLVED_FROM 找链，用轻量规则串一句；LLM 可选省略以省延迟。"""
        from sqlalchemy import select
        from app.models.engram import EngramEdge

        top_ids = [r.node_id for r in cluster.top(5)]
        if len(top_ids) < 2:
            return None

        snippets: list[str] = []
        for nid in top_ids[:4]:
            er = await self.graph.session.execute(
                select(EngramEdge)
                .where(
                    EngramEdge.from_node_id == nid,
                    EngramEdge.edge_type.in_(["CAUSED_BY", "EVOLVED_FROM"]),
                )
                .limit(1)
            )
            edge = er.scalar_one_or_none()
            if not edge:
                continue
            try:
                nxt = await self.graph.get_node(edge.to_node_id)
                snippets.append(str(nxt.get("content", ""))[:120])
            except KeyError:
                continue

        if not snippets:
            parts = [str(r.raw_content.get("content", ""))[:60] for r in cluster.top(3)]
            fallback = " → ".join(p for p in parts if p)
            return f"{self_core.name} 的记忆线索：{fallback}" if fallback else None

        return f"{self_core.name} 的叙事线：{' → '.join(snippets[:3])}"
