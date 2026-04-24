from pathlib import Path
import sys

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import app


def test_healthz_has_checks_field():
    client = TestClient(app)
    response = client.get("/healthz")
    assert response.status_code in (200, 503)
    body = response.json()
    assert "checks" in body
    assert "db" in body["checks"]
    assert "config" in body["checks"]

