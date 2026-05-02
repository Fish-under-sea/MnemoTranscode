"""archives：置顶与国家/非遗扩展著录字段

Revision ID: d7e8f9a1b2c4
Revises: c3d9e001f2aa
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d7e8f9a1b2c4"
down_revision: Union[str, None] = "c3d9e001f2aa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "archives",
        sa.Column("is_pinned", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column(
        "archives",
        sa.Column(
            "pinned_order",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.add_column("archives", sa.Column("heritage_origin_regions", sa.Text(), nullable=True))
    op.add_column("archives", sa.Column("heritage_listing_level", sa.String(160), nullable=True))
    op.add_column("archives", sa.Column("heritage_inscribed_year", sa.String(160), nullable=True))


def downgrade() -> None:
    op.drop_column("archives", "heritage_inscribed_year")
    op.drop_column("archives", "heritage_listing_level")
    op.drop_column("archives", "heritage_origin_regions")
    op.drop_column("archives", "pinned_order")
    op.drop_column("archives", "is_pinned")
