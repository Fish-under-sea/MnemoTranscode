# MnemoTranscode V2 · 神经激活引擎（能量传播公式与 Core Pack 一致）

from __future__ import annotations

import math
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any

from app.mnemo.protocols import GraphManagerProtocol


@dataclass
class ActivationResult:
    """单个节点的激活结果"""

    node_id: str
    node_type: str
    energy: float
    depth: int
    path: list[str]
    raw_content: dict[str, Any] = field(default_factory=dict)


@dataclass
class ActivationCluster:
    """一次召回返回的完整激活记忆簇"""

    query: str
    seeds: list[str]
    activated: list[ActivationResult]
    total_energy: float
    timestamp: float = field(default_factory=time.time)

    def top(self, n: int = 5) -> list[ActivationResult]:
        return self.activated[:n]

    def by_type(self, node_type: str) -> list[ActivationResult]:
        return [r for r in self.activated if r.node_type == node_type]


def compute_next_energy(
    current_energy: float,
    edge_weight: float,
    node_importance: float,
    freshness_factor: float,
    depth: int,
    *,
    decay_base: float = 0.65,
    min_energy: float = 0.05,
) -> float | None:
    """神经激活能量传播公式（禁止删除任一乘法因子）。"""
    next_e = (
        current_energy
        * edge_weight
        * node_importance
        * freshness_factor
        * (decay_base**depth)
    )
    return next_e if next_e >= min_energy else None


def freshness_factor_from_ts(last_access_ts: float, lam: float = 0.05) -> float:
    """指数遗忘曲线 f = e^(-λ·days)"""
    days = (time.time() - last_access_ts) / 86400
    return math.exp(-lam * max(days, 0.0))


class ActivationEngine:
    """Spreading Activation 引擎（deque BFS + 多路径取最大能量）。"""

    def __init__(
        self,
        graph: GraphManagerProtocol,
        *,
        max_depth: int = 4,
        max_nodes: int = 40,
        decay_base: float = 0.65,
        min_energy: float = 0.05,
        lam: float = 0.05,
    ) -> None:
        self.graph = graph
        self.max_depth = max_depth
        self.max_nodes = max_nodes
        self.decay_base = decay_base
        self.min_energy = min_energy
        self.lam = lam

    async def activate(
        self,
        query: str,
        seed_ids: list[str],
        *,
        initial_energy: float = 1.0,
    ) -> ActivationCluster:
        visited: dict[str, ActivationResult] = {}
        queue: deque[tuple[str, float, int, list[str]]] = deque()

        for seed_id in seed_ids:
            queue.append((seed_id, initial_energy, 0, [seed_id]))

        while queue and len(visited) < self.max_nodes:
            node_id, energy, depth, path = queue.popleft()

            if node_id in visited:
                if visited[node_id].energy < energy:
                    visited[node_id].energy = energy
                continue

            try:
                node_data = await self.graph.get_node(node_id)
            except KeyError:
                continue

            result = ActivationResult(
                node_id=node_id,
                node_type=node_data.get("type") or node_data.get("node_type") or "Unknown",
                energy=energy,
                depth=depth,
                path=path,
                raw_content=node_data,
            )
            visited[node_id] = result

            if depth >= self.max_depth:
                continue

            neighbors = await self.graph.get_neighbors(node_id)
            for nbr in neighbors:
                nbr_id = nbr["id"]
                if nbr_id in visited:
                    continue
                la = float(nbr.get("last_access_ts") or time.time())
                ff = freshness_factor_from_ts(la, self.lam)
                next_e = compute_next_energy(
                    energy,
                    edge_weight=float(nbr.get("edge_weight", 0.5)),
                    node_importance=float(nbr.get("importance", 0.5)),
                    freshness_factor=ff,
                    depth=depth + 1,
                    decay_base=self.decay_base,
                    min_energy=self.min_energy,
                )
                if next_e is not None:
                    queue.append((nbr_id, float(next_e), depth + 1, path + [nbr_id]))

        activated = sorted(visited.values(), key=lambda r: r.energy, reverse=True)
        total_energy = sum(r.energy for r in activated)

        if len(activated) > 1:
            await self.graph.reinforce_coactivation([r.node_id for r in activated[:10]])

        return ActivationCluster(
            query=query,
            seeds=seed_ids,
            activated=activated,
            total_energy=total_energy,
        )
