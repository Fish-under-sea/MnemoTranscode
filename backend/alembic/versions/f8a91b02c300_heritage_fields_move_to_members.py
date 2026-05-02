"""著录字段从 archives 迁到 members（每记忆实体自有著录）

Revision ID: f8a91b02c300
Revises: e2b3c4d5e6f8

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f8a91b02c300"
down_revision: Union[str, None] = "e2b3c4d5e6f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("members", sa.Column("heritage_origin_regions", sa.Text(), nullable=True))
    op.add_column("members", sa.Column("heritage_listing_level", sa.String(length=160), nullable=True))
    op.add_column("members", sa.Column("heritage_inscribed_year", sa.String(length=160), nullable=True))

    # 将既有档案层著录复制到该档案下所有成员（多端一致；用户可在各实体上再改）
    op.execute(
        """
        UPDATE members AS m SET
          heritage_origin_regions = a.heritage_origin_regions,
          heritage_listing_level = a.heritage_listing_level,
          heritage_inscribed_year = a.heritage_inscribed_year
        FROM archives AS a
        WHERE m.archive_id = a.id
          AND (
            a.heritage_origin_regions IS NOT NULL
            OR a.heritage_listing_level IS NOT NULL
            OR a.heritage_inscribed_year IS NOT NULL
          )
        """
    )

    op.drop_column("archives", "heritage_inscribed_year")
    op.drop_column("archives", "heritage_listing_level")
    op.drop_column("archives", "heritage_origin_regions")


def downgrade() -> None:
    op.add_column("archives", sa.Column("heritage_origin_regions", sa.Text(), nullable=True))
    op.add_column("archives", sa.Column("heritage_listing_level", sa.String(length=160), nullable=True))
    op.add_column("archives", sa.Column("heritage_inscribed_year", sa.String(length=160), nullable=True))

    # 尽力回滚：用每个档案下「按 id 最小且含发源地」成员的著录写回档案（无则保持 NULL）
    op.execute(
        """
        UPDATE archives AS ar SET heritage_origin_regions = sub.h_o,
          heritage_listing_level = sub.h_l,
          heritage_inscribed_year = sub.h_y
        FROM (
          SELECT DISTINCT ON (archive_id)
            archive_id,
            heritage_origin_regions AS h_o,
            heritage_listing_level AS h_l,
            heritage_inscribed_year AS h_y
          FROM members
          WHERE heritage_origin_regions IS NOT NULL
             OR heritage_listing_level IS NOT NULL
             OR heritage_inscribed_year IS NOT NULL
          ORDER BY archive_id, id ASC
        ) AS sub
        WHERE ar.id = sub.archive_id
        """
    )

    op.drop_column("members", "heritage_inscribed_year")
    op.drop_column("members", "heritage_listing_level")
    op.drop_column("members", "heritage_origin_regions")
