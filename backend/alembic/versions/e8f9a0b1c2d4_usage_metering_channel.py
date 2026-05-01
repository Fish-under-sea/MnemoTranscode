"""usage_records: metering_channel 订阅配额 / 用户自备密钥

Revision ID: e8f9a0b1c2d4
Revises: d4e8a1c2b3f4
Create Date: 2026-05-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e8f9a0b1c2d4"
down_revision: str | None = "d4e8a1c2b3f4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "usage_records",
        sa.Column("metering_channel", sa.String(length=32), nullable=True),
    )
    op.create_index(
        "ix_usage_metering_channel",
        "usage_records",
        ["user_id", "metering_channel", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_usage_metering_channel", table_name="usage_records")
    op.drop_column("usage_records", "metering_channel")
