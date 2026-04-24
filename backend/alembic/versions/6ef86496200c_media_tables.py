"""media_tables

Revision ID: 6ef86496200c
Revises: b5b55762bdc8
Create Date: 2026-04-24 21:02:45.588713

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6ef86496200c'
down_revision: Union[str, Sequence[str], None] = 'b5b55762bdc8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "media_upload_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("upload_id", sa.String(length=36), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("archive_id", sa.Integer(), nullable=True),
        sa.Column("member_id", sa.Integer(), nullable=True),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("object_key", sa.String(length=512), nullable=False),
        sa.Column("content_type", sa.String(length=128), nullable=False),
        sa.Column("declared_size", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="initiated"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("upload_id"),
        sa.UniqueConstraint("object_key"),
    )
    op.create_index("ix_media_upload_sessions_id", "media_upload_sessions", ["id"])
    op.create_index("ix_media_upload_sessions_upload_id", "media_upload_sessions", ["upload_id"])
    op.create_index("ix_media_upload_sessions_owner_id", "media_upload_sessions", ["owner_id"])

    op.create_table(
        "media_assets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("source_upload_session_id", sa.Integer(), nullable=True),
        sa.Column("object_key", sa.String(length=512), nullable=False),
        sa.Column("bucket", sa.String(length=64), nullable=False),
        sa.Column("content_type", sa.String(length=128), nullable=False),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("visibility", sa.String(length=16), nullable=False, server_default="private"),
        sa.Column("archive_id", sa.Integer(), nullable=True),
        sa.Column("member_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["source_upload_session_id"], ["media_upload_sessions.id"], ondelete="SET NULL"
        ),
        sa.UniqueConstraint("object_key"),
    )
    op.create_index("ix_media_assets_id", "media_assets", ["id"])
    op.create_index("ix_media_assets_owner_id", "media_assets", ["owner_id"])
    op.create_index("ix_media_assets_source_upload_session_id", "media_assets", ["source_upload_session_id"])
    op.create_index("ix_media_assets_archive_id", "media_assets", ["archive_id"])
    op.create_index("ix_media_assets_member_id", "media_assets", ["member_id"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_media_assets_member_id", table_name="media_assets")
    op.drop_index("ix_media_assets_archive_id", table_name="media_assets")
    op.drop_index("ix_media_assets_source_upload_session_id", table_name="media_assets")
    op.drop_index("ix_media_assets_owner_id", table_name="media_assets")
    op.drop_index("ix_media_assets_id", table_name="media_assets")
    op.drop_table("media_assets")

    op.drop_index("ix_media_upload_sessions_owner_id", table_name="media_upload_sessions")
    op.drop_index("ix_media_upload_sessions_upload_id", table_name="media_upload_sessions")
    op.drop_index("ix_media_upload_sessions_id", table_name="media_upload_sessions")
    op.drop_table("media_upload_sessions")
