"""
tests/test_health.py
--------------------
Validates: GET /health
"""


def test_health_returns_ok(client):
    """Health endpoint must return 200 with status='ok' and a timestamp."""
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "MiniSearch"
    assert "timestamp" in body
    assert body["timestamp"]  # non-empty
