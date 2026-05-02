"""成员 Engram 图：与 /memories/mnemo-graph 一致的裁剪规则，供导出/克隆复用。"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.engram import EngramEdge, EngramNode
from app.models.memory import Memory


async def list_pruned_engrams_for_member(
    db: AsyncSession,
    *,
    user_id: int,
    member_id: int,
) -> tuple[list[EngramNode], list[EngramEdge]]:
    """返回该成员下参与可视关系网的节点与边（与 get_mnemo_graph 筛选一致）。"""
    nr = await db.execute(
        select(EngramNode).where(
            EngramNode.member_id == member_id,
            EngramNode.user_id == user_id,
            EngramNode.is_deprecated.is_(False),
        )
    )
    nodes_orm = list(nr.scalars().all())
    mem_ids_r = await db.execute(select(Memory.id).where(Memory.member_id == member_id))
    valid_memory_ids = {row[0] for row in mem_ids_r.all()}
    filtered: list[EngramNode] = []
    for n in nodes_orm:
        if n.memory_id is not None:
            if n.memory_id in valid_memory_ids:
                filtered.append(n)
            continue
        if n.node_type == "Event":
            continue
        filtered.append(n)
    nodes_orm = filtered
    node_ids = {n.id for n in nodes_orm}
    if not node_ids:
        return [], []

    er = await db.execute(
        select(EngramEdge).where(
            EngramEdge.from_node_id.in_(node_ids),
            EngramEdge.to_node_id.in_(node_ids),
        )
    )
    edges_orm = list(er.scalars().all())

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
    nodes_orm = pruned_nodes
    node_ids = {n.id for n in nodes_orm}
    if not node_ids:
        return [], []
    edges_orm = [e for e in edges_orm if e.from_node_id in node_ids and e.to_node_id in node_ids]
    return nodes_orm, edges_orm
