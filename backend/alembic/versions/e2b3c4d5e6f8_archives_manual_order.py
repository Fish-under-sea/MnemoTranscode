"""archives：手工排序 manual_order

Revision ID: e2b3c4d5e6f8
Revises: d7e8f9a1b2c4
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e2b3c4d5e6f8"
down_revision: Union[str, None] = "d7e8f9a1b2c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "archives",
        sa.Column(
            "manual_order",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("archives", "manual_order")
