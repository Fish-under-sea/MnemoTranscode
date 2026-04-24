"""repair_members_status_columns_if_missing

幂等补丁：当 alembic_version 已是 head 但 members 表仍缺少 status/end_year
（例如曾对错误库 stamp）时补齐列、数据回填与约束。

Revision ID: c7a9e1b2d4f0
Revises: 6ef86496200c
Create Date: 2026-04-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "c7a9e1b2d4f0"
down_revision: Union[str, Sequence[str], None] = "6ef86496200c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    col_names = {c["name"] for c in inspector.get_columns("members")}

    if "status" in col_names and "end_year" in col_names:
        return

    added_status = "status" not in col_names
    added_end_year = "end_year" not in col_names

    if added_status:
        op.add_column("members", sa.Column("status", sa.String(length=16), nullable=True))
    if added_end_year:
        op.add_column("members", sa.Column("end_year", sa.Integer(), nullable=True))

    if added_status:
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

        inspector = inspect(bind)
        checks = inspector.get_check_constraints("members")
        if not any(c.get("name") == "ck_members_status_enum" for c in checks):
            op.create_check_constraint(
                "ck_members_status_enum",
                "members",
                "status IN ('active','passed','distant','pet','other')",
            )

        op.alter_column("members", "is_alive", existing_type=sa.Boolean(), nullable=True)

        indexes = {ix["name"] for ix in inspector.get_indexes("members")}
        if "ix_members_status" not in indexes:
            op.create_index("ix_members_status", "members", ["status"], unique=False)
    elif added_end_year:
        op.execute(
            """
            UPDATE members
            SET end_year = death_year
            WHERE end_year IS NULL AND death_year IS NOT NULL
            """
        )


def downgrade() -> None:
    pass
