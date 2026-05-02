"""dialogue_chat_messages.extras(JSONB)：存表情包等媒体引用"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "b2c3d4e5f6a8"
down_revision: str = "a9c1f2e3b4d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "dialogue_chat_messages",
        sa.Column("extras", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("dialogue_chat_messages", "extras")
