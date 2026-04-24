from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_target_routes_no_longer_raise_http_exception_directly():
    target_files = [
        ROOT / "app" / "api" / "v1" / "archive.py",
        ROOT / "app" / "api" / "v1" / "memory.py",
        ROOT / "app" / "api" / "v1" / "media.py",
    ]
    for file_path in target_files:
        content = file_path.read_text(encoding="utf-8")
        assert "raise HTTPException(" not in content

