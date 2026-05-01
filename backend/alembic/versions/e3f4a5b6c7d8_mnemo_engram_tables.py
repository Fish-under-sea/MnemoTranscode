"""MnemoTranscode engram 图记忆表 + members.mnemo_self_core

Revision ID: e3f4a5b6c7d8
Revises: d4e8a1c2b3f4
Create Date: 2026-05-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e3f4a5b6c7d8"
down_revision: str | None = "d4e8a1c2b3f4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "engram_nodes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=True),
        sa.Column("memory_id", sa.Integer(), nullable=True),
        sa.Column("node_type", sa.String(length=64), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("activation_energy", sa.Float(), nullable=False),
        sa.Column("decay_rate", sa.Float(), nullable=False),
        sa.Column("plasticity", sa.Float(), nullable=False),
        sa.Column("importance", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("last_access", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("access_count", sa.Integer(), nullable=False),
        sa.Column("is_deprecated", sa.Boolean(), nullable=False),
        sa.Column("deprecation_reason", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["memory_id"], ["memories.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_engram_nodes_member_id", "engram_nodes", ["member_id"], unique=False)
    op.create_index("ix_engram_nodes_memory_id", "engram_nodes", ["memory_id"], unique=False)
    op.create_index("ix_engram_nodes_node_type", "engram_nodes", ["node_type"], unique=False)
    op.create_index("ix_engram_nodes_user_id", "engram_nodes", ["user_id"], unique=False)
    op.create_index(
        "ix_engram_user_member_type", "engram_nodes", ["user_id", "member_id", "node_type"], unique=False
    )

    op.create_table(
        "engram_edges",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("from_node_id", sa.String(length=36), nullable=False),
        sa.Column("to_node_id", sa.String(length=36), nullable=False),
        sa.Column("edge_type", sa.String(length=64), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False),
        sa.Column("coactivation_count", sa.Integer(), nullable=False),
        sa.Column("meta", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["from_node_id"], ["engram_nodes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["to_node_id"], ["engram_nodes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_engram_edges_edge_type", "engram_edges", ["edge_type"], unique=False)
    op.create_index("ix_engram_edges_from_node_id", "engram_edges", ["from_node_id"], unique=False)
    op.create_index("ix_engram_edges_to_node_id", "engram_edges", ["to_node_id"], unique=False)
    op.create_index(
        "ix_engram_edge_endpoints", "engram_edges", ["from_node_id", "to_node_id", "edge_type"], unique=False
    )

    op.add_column("members", sa.Column("mnemo_self_core", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("members", "mnemo_self_core")
    op.drop_index("ix_engram_edge_endpoints", table_name="engram_edges")
    op.drop_index("ix_engram_edges_to_node_id", table_name="engram_edges")
    op.drop_index("ix_engram_edges_from_node_id", table_name="engram_edges")
    op.drop_index("ix_engram_edges_edge_type", table_name="engram_edges")
    op.drop_table("engram_edges")
    op.drop_index("ix_engram_user_member_type", table_name="engram_nodes")
    op.drop_index("ix_engram_nodes_user_id", table_name="engram_nodes")
    op.drop_index("ix_engram_nodes_node_type", table_name="engram_nodes")
    op.drop_index("ix_engram_nodes_memory_id", table_name="engram_nodes")
    op.drop_index("ix_engram_nodes_member_id", table_name="engram_nodes")
    op.drop_table("engram_nodes")
