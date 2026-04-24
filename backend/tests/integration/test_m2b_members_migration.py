from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.models.memory import Member


def test_member_model_has_status_and_end_year_columns():
    columns = Member.__table__.columns.keys()
    assert "status" in columns
    assert "end_year" in columns


def test_member_is_alive_column_is_nullable():
    assert Member.__table__.columns["is_alive"].nullable is True

