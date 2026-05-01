"""Engram 图：PostgreSQL + SQLAlchemy 实现 GraphManagerProtocol。"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select, update, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.engram import EngramNode, EngramEdge

_EDGE_TYPE_OK = re.compile(r"^[A-Z][A-Z0-9_]*$")


def _assert_edge_type(edge_type: str) -> None:
    if not _EDGE_TYPE_OK.match(edge_type):
        raise ValueError(f"非法边类型: {edge_type}")


class SqlAlchemyGraphManager:
    """按用户隔离的异步图管理器。"""

    def __init__(self, session: AsyncSession, user_id: int) -> None:
        self.session = session
        self.user_id = user_id

    def _node_public_dict(self, n: EngramNode) -> dict[str, Any]:
        la = n.last_access
        ts = la.timestamp() if isinstance(la, datetime) else __import__("time").time()
        return {
            "id": n.id,
            "type": n.node_type,
            "node_type": n.node_type,
            "content": n.content,
            "importance": n.importance,
            "activation_energy": n.activation_energy,
            "decay_rate": n.decay_rate,
            "plasticity": n.plasticity,
            "member_id": n.member_id,
            "memory_id": n.memory_id,
            "is_deprecated": n.is_deprecated,
            "last_access_ts": ts,
        }

    async def create_node(
        self,
        node_type: str,
        content: str,
        *,
        member_id: int | None = None,
        memory_id: int | None = None,
        importance: float = 0.5,
        activation_energy: float = 0.5,
        decay_rate: float = 0.02,
        plasticity: float = 0.8,
    ) -> str:
        node_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        n = EngramNode(
            id=node_id,
            user_id=self.user_id,
            member_id=member_id,
            memory_id=memory_id,
            node_type=node_type,
            content=content,
            importance=importance,
            activation_energy=activation_energy,
            decay_rate=decay_rate,
            plasticity=plasticity,
            last_access=now,
            access_count=0,
            is_deprecated=False,
        )
        self.session.add(n)
        await self.session.flush()
        return node_id

    async def get_node(self, node_id: str) -> dict[str, Any]:
        r = await self.session.execute(
            select(EngramNode).where(
                EngramNode.id == node_id,
                EngramNode.user_id == self.user_id,
                EngramNode.is_deprecated.is_(False),
            )
        )
        n = r.scalar_one_or_none()
        if n is None:
            raise KeyError(node_id)
        n.last_access = datetime.now(timezone.utc)
        n.access_count = int(n.access_count or 0) + 1
        await self.session.flush()
        return self._node_public_dict(n)

    async def get_neighbors(self, node_id: str) -> list[dict[str, Any]]:
        r = await self.session.execute(
            select(EngramEdge, EngramNode)
            .join(EngramNode, EngramEdge.to_node_id == EngramNode.id)
            .where(
                EngramEdge.from_node_id == node_id,
                EngramNode.user_id == self.user_id,
                EngramNode.is_deprecated.is_(False),
            )
            .order_by(EngramEdge.weight.desc())
            .limit(20)
        )
        out: list[dict[str, Any]] = []
        for edge, target in r.all():
            la = target.last_access
            ts = la.timestamp() if isinstance(la, datetime) else __import__("time").time()
            out.append(
                {
                    "id": target.id,
                    "type": target.node_type,
                    "edge_weight": float(edge.weight),
                    "importance": float(target.importance),
                    "last_access_ts": ts,
                }
            )
        return out

    async def create_edge(
        self,
        from_id: str,
        to_id: str,
        edge_type: str,
        *,
        weight: float = 0.5,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        _assert_edge_type(edge_type)
        e = EngramEdge(
            from_node_id=from_id,
            to_node_id=to_id,
            edge_type=edge_type,
            weight=weight,
            coactivation_count=0,
            meta=metadata,
        )
        self.session.add(e)
        await self.session.flush()

    async def reinforce_coactivation(self, node_ids: list[str]) -> None:
        if len(node_ids) < 2:
            return
        ids = sorted({i for i in node_ids if i})
        for i, a in enumerate(ids):
            for b in ids[i + 1 :]:
                await self._reinforce_pair(a, b)

    async def _reinforce_pair(self, id_a: str, id_b: str) -> None:
        r = await self.session.execute(
            select(EngramEdge).where(
                EngramEdge.from_node_id == id_a,
                EngramEdge.to_node_id == id_b,
                EngramEdge.edge_type == "COACTIVATED_WITH",
            )
        )
        edge = r.scalar_one_or_none()
        if edge is None:
            edge = EngramEdge(
                from_node_id=id_a,
                to_node_id=id_b,
                edge_type="COACTIVATED_WITH",
                weight=0.1,
                coactivation_count=0,
            )
            self.session.add(edge)
            await self.session.flush()
        edge.coactivation_count = int(edge.coactivation_count or 0) + 1
        edge.weight = min(1.0, float(edge.weight or 0.1) + 0.05)
        await self.session.flush()

    async def deprecate_node(self, node_id: str, reason: str = "") -> None:
        await self.session.execute(
            update(EngramNode)
            .where(EngramNode.id == node_id, EngramNode.user_id == self.user_id)
            .values(is_deprecated=True, deprecation_reason=reason or None)
        )

    async def get_recent_nodes(self, hours: float = 0.5) -> list[str]:
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        r = await self.session.execute(
            select(EngramNode.id).where(
                EngramNode.user_id == self.user_id,
                EngramNode.created_at >= since,
                EngramNode.is_deprecated.is_(False),
            )
        )
        return [row[0] for row in r.all()]

    async def get_edges(self, node_id: str, edge_type: str | None = None) -> list[dict[str, Any]]:
        q = select(EngramEdge).where(EngramEdge.from_node_id == node_id)
        if edge_type:
            _assert_edge_type(edge_type)
            q = q.where(EngramEdge.edge_type == edge_type)
        r = await self.session.execute(q)
        rows = []
        for e in r.scalars().all():
            rows.append(
                {
                    "edge_type": e.edge_type,
                    "target_id": e.to_node_id,
                    "weight": e.weight,
                    "similarity": (e.meta or {}).get("similarity", 0.9),
                    "conflict_type": (e.meta or {}).get("conflict_type", "factual"),
                }
            )
        return rows
