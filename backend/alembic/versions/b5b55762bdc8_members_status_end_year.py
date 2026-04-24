"""members_status_end_year

Revision ID: b5b55762bdc8
Revises: 861ffc1e3691
Create Date: 2026-04-24 20:50:42.695149

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b5b55762bdc8'
down_revision: Union[str, Sequence[str], None] = '861ffc1e3691'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("members", sa.Column("status", sa.String(length=16), nullable=True))
    op.add_column("members", sa.Column("end_year", sa.Integer(), nullable=True))

    op.execute(
        """
        UPDATE members
        SET status = CASE
            WHEN is_alive = TRUE THEN 'active'
            WHEN is_alive = FALSE THEN 'passed'
            ELSE 'active'
        END,
        end_year = CASE
            WHEN death_year IS NOT NULL THEN death_year
            ELSE end_year
        END
        """
    )

    op.alter_column("members", "status", existing_type=sa.String(length=16), nullable=False)
    op.create_check_constraint(
        "ck_members_status_enum",
        "members",
        "status IN ('active','passed','distant','pet','other')",
    )
    op.alter_column("members", "is_alive", existing_type=sa.Boolean(), nullable=True)
    op.create_index("ix_members_status", "members", ["status"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_members_status", table_name="members")
    op.drop_constraint("ck_members_status_enum", "members", type_="check")
    op.execute("UPDATE members SET is_alive = TRUE WHERE is_alive IS NULL")
    op.alter_column("members", "is_alive", existing_type=sa.Boolean(), nullable=False)
    op.drop_column("members", "end_year")
    op.drop_column("members", "status")
