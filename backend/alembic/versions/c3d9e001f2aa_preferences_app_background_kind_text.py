"""user_preferences：app_background_kind + URL 加长 Text

Revision ID: c3d9e001f2aa
Revises: b2c3d4e5f6a8
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d9e001f2aa"
down_revision: Union[str, None] = "b2c3d4e5f6a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column("app_background_kind", sa.String(length=16), nullable=True),
    )
    op.alter_column(
        "user_preferences",
        "app_background_url",
        existing_type=sa.String(length=1024),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "user_preferences",
        "app_background_url",
        existing_type=sa.Text(),
        type_=sa.String(length=1024),
        existing_nullable=True,
    )
    op.drop_column("user_preferences", "app_background_kind")
