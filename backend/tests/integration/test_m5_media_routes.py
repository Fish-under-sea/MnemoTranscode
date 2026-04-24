from pathlib import Path
import sys

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import app


def test_media_two_phase_routes_exist_and_require_auth():
    client = TestClient(app)

    init_resp = client.post("/api/v1/media/uploads/init", json={})
    complete_resp = client.post("/api/v1/media/uploads/complete", json={})
    get_resp = client.get("/api/v1/media/1/download-url")

    assert init_resp.status_code == 401
    assert complete_resp.status_code == 401
    assert get_resp.status_code == 401

