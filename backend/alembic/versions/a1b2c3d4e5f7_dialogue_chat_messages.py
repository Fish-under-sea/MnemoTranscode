"""dialogue_chat_messages 账号级对话持久化

Revision ID: a1b2c3d4e5f7
Revises: f1a2b3c4d5e6
Create Date: 2026-05-02

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dialogue_chat_messages",
        sa.Column("id", sa.Integer(), sa.Identity(always=False), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("archive_id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["archive_id"], ["archives.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dialogue_chat_messages_archive_id", "dialogue_chat_messages", ["archive_id"])
    op.create_index("ix_dialogue_chat_messages_id", "dialogue_chat_messages", ["id"])
    op.create_index("ix_dialogue_chat_messages_member_id", "dialogue_chat_messages", ["member_id"])
    op.create_index("ix_dialogue_chat_messages_user_id", "dialogue_chat_messages", ["user_id"])
    op.create_index(
        "ix_dialogue_chat_user_member_created",
        "dialogue_chat_messages",
        ["user_id", "member_id", "id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_dialogue_chat_user_member_created", table_name="dialogue_chat_messages")
    op.drop_index("ix_dialogue_chat_messages_user_id", table_name="dialogue_chat_messages")
    op.drop_index("ix_dialogue_chat_messages_member_id", table_name="dialogue_chat_messages")
    op.drop_index("ix_dialogue_chat_messages_id", table_name="dialogue_chat_messages")
    op.drop_index("ix_dialogue_chat_messages_archive_id", table_name="dialogue_chat_messages")
    op.drop_table("dialogue_chat_messages")
