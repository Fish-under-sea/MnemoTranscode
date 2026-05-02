"""media_assets 增加 extras(JSONB)，供表情包 AI 标签等扩展元数据"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "a9c1f2e3b4d5"
down_revision: str = "e3887247034b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "media_assets",
        sa.Column("extras", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("media_assets", "extras")
