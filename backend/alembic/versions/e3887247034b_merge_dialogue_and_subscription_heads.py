"""合并 Alembic 双 head：dialogue_chat_messages 与 subscription tier 迁移分支

Revision ID: e3887247034b
Revises: a1b2c3d4e5f7, f0a1b2c3d4e5

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3887247034b'
down_revision: Union[str, Sequence[str], None] = ('a1b2c3d4e5f7', 'f0a1b2c3d4e5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
