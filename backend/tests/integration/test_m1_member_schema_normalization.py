from pathlib import Path
import sys

import pytest
from pydantic import ValidationError

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.schemas.memory import MemberCreate, MemberUpdate


def test_member_create_accepts_new_status_fields():
    payload = MemberCreate(
        archive_id=1,
        name="阿青",
        relationship_type="friend",
        status="active",
    )
    assert payload.status == "active"


def test_member_create_requires_status_or_legacy_source():
    with pytest.raises(ValidationError) as exc:
        MemberCreate(archive_id=1, name="阿青", relationship_type="friend")
    assert "VALIDATION_REQUIRED_STATUS" in str(exc.value)


def test_member_update_name_only_is_allowed():
    payload = MemberUpdate(name="仅改名")
    assert payload.name == "仅改名"


def test_member_create_rejects_status_death_year_conflict():
    with pytest.raises(ValidationError) as exc:
        MemberCreate(
            archive_id=1,
            name="阿青",
            relationship_type="friend",
            status="distant",
            death_year=2020,
        )
    assert "FIELD_CONFLICT_STATUS_DEATH_YEAR" in str(exc.value)

