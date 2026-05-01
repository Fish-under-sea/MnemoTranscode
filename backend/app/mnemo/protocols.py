"""图存储抽象，便于日后换 Neo4j 实现。"""

from __future__ import annotations

from typing import Any, Protocol


class GraphManagerProtocol(Protocol):
    """ActivationEngine 仅依赖此接口。"""

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
    ) -> str: ...

    async def get_neighbors(self, node_id: str) -> list[dict]:
        """返回邻居：id, type, edge_weight, importance, last_access_ts。"""

    async def get_node(self, node_id: str) -> dict:
        """返回节点属性 dict（含 type/content/importance 等）。"""

    async def reinforce_coactivation(self, node_ids: list[str]) -> None:
        """Hebbian：共激活节点对边加权。"""

    async def create_edge(
        self,
        from_id: str,
        to_id: str,
        edge_type: str,
        *,
        weight: float = 0.5,
        metadata: dict[str, Any] | None = None,
    ) -> None: ...

    async def deprecate_node(self, node_id: str, reason: str = "") -> None: ...

    async def get_recent_nodes(self, hours: float = 0.5) -> list[str]: ...

    async def get_edges(self, node_id: str, edge_type: str | None = None) -> list[dict]: ...
