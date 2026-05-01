"""
MnemoTranscode：图记忆（Engram）ORM

PostgreSQL 存储节点与边，等价于 Core Pack 中 Neo4j EngramNode 拓扑。
"""

from __future__ import annotations

import uuid

from sqlalchemy import (
    Column,
    String,
    Text,
    Float,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    JSON,
    func,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


def _uuid_str() -> str:
    return str(uuid.uuid4())


class EngramNode(Base):
    """与文档中 EngramNode 属性对齐的节点（无外置 Neo4j 时在 PG 落库）。"""

    __tablename__ = "engram_nodes"

    id = Column(String(36), primary_key=True, default=_uuid_str)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=True, index=True)
    memory_id = Column(Integer, ForeignKey("memories.id", ondelete="SET NULL"), nullable=True, index=True)

    node_type = Column(String(64), nullable=False, index=True)
    content = Column(Text, nullable=False, default="")

    activation_energy = Column(Float, nullable=False, default=0.5)
    decay_rate = Column(Float, nullable=False, default=0.02)
    plasticity = Column(Float, nullable=False, default=0.8)
    importance = Column(Float, nullable=False, default=0.5)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_access = Column(DateTime(timezone=True), server_default=func.now())
    access_count = Column(Integer, nullable=False, default=0)
    is_deprecated = Column(Boolean, nullable=False, default=False)
    deprecation_reason = Column(Text, nullable=True)

    out_edges = relationship(
        "EngramEdge",
        foreign_keys="EngramEdge.from_node_id",
        back_populates="from_node",
        cascade="all, delete-orphan",
    )
    in_edges = relationship(
        "EngramEdge",
        foreign_keys="EngramEdge.to_node_id",
        back_populates="to_node",
    )

    __table_args__ = (
        Index("ix_engram_user_member_type", "user_id", "member_id", "node_type"),
    )


class EngramEdge(Base):
    """有向边：RELATED_TO / CAUSED_BY / CONTRADICTS / COACTIVATED_WITH 等。"""

    __tablename__ = "engram_edges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    from_node_id = Column(String(36), ForeignKey("engram_nodes.id", ondelete="CASCADE"), nullable=False)
    to_node_id = Column(String(36), ForeignKey("engram_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    edge_type = Column(String(64), nullable=False, index=True)

    weight = Column(Float, nullable=False, default=0.5)
    coactivation_count = Column(Integer, nullable=False, default=0)
    meta = Column(JSON, nullable=True)

    from_node = relationship(
        "EngramNode",
        foreign_keys=[from_node_id],
        back_populates="out_edges",
    )
    to_node = relationship(
        "EngramNode",
        foreign_keys=[to_node_id],
        back_populates="in_edges",
    )

    __table_args__ = (
        Index("ix_engram_edge_endpoints", "from_node_id", "to_node_id", "edge_type"),
    )
