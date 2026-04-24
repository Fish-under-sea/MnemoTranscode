"""user_preferences: app_background_url 网页应用背景图

Revision ID: d4e8a1c2b3f4
Revises: c7a9e1b2d4f0
Create Date: 2026-04-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4e8a1c2b3f4"
down_revision: str | None = "c7a9e1b2d4f0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column("app_background_url", sa.String(length=1024), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_preferences", "app_background_url")
