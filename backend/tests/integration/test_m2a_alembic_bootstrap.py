from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_main_has_no_create_all_call():
    content = (ROOT / "app" / "main.py").read_text(encoding="utf-8")
    assert "create_all" not in content
    assert "init_db" not in content


def test_alembic_files_exist():
    assert (ROOT / "alembic.ini").exists()
    assert (ROOT / "alembic" / "env.py").exists()

