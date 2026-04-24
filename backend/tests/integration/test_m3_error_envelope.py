from pathlib import Path
import sys

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import app


def test_http_error_uses_envelope_and_request_id():
    client = TestClient(app)
    response = client.get("/api/v1/archives")

    assert response.status_code == 401
    body = response.json()
    assert body["error_code"] == "AUTH_UNAUTHORIZED"
    assert "message" in body
    assert body.get("request_id")
    assert response.headers.get("X-Request-ID") == body["request_id"]

