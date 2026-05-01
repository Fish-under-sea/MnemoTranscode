"""订阅档位 legacy：enterprise → max，并按新四档刷新 monthly_token_limit

Revision ID: f0a1b2c3d4e5
Revises: e8f9a0b1c2d4
Create Date: 2026-05-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f0a1b2c3d4e5"
down_revision: str | None = "e8f9a0b1c2d4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    def run(sql: str) -> None:
        op.execute(sa.text(sql))

    if dialect == "postgresql":
        run("UPDATE users SET subscription_tier = 'max' WHERE subscription_tier = 'enterprise'")
    else:
        run(
            "UPDATE users SET subscription_tier = 'max' "
            "WHERE LOWER(COALESCE(subscription_tier, '')) = 'enterprise'"
        )

    run(
        "UPDATE users SET subscription_tier = 'free' "
        "WHERE subscription_tier IS NULL OR TRIM(subscription_tier) = ''"
    )
    run(
        "UPDATE users SET monthly_token_limit = 50000000 WHERE subscription_tier = 'free'"
    )
    run(
        "UPDATE users SET monthly_token_limit = 100000000 WHERE subscription_tier = 'lite'"
    )
    run(
        "UPDATE users SET monthly_token_limit = 300000000 WHERE subscription_tier = 'pro'"
    )
    run(
        "UPDATE users SET monthly_token_limit = 800000000 WHERE subscription_tier = 'max'"
    )


def downgrade() -> None:
    pass
