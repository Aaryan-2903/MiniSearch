"""
tests/conftest.py
-----------------
Shared pytest fixtures.

Isolation strategy:
- Each test gets its own temporary SQLite DB file and upload directory via tmp_path.
- `unittest.mock.patch` replaces the module-level DB_PATH and UPLOAD_DIR attributes
  before the TestClient triggers the FastAPI lifespan (which calls init_db()).
- This guarantees zero state leaks between tests.
"""

import os
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path):
    """
    Return a TestClient backed by a completely isolated temporary environment.
    The DB and uploads directory are wiped between tests automatically (tmp_path).
    """
    db_path = str(tmp_path / "test.db")
    upload_dir = str(tmp_path / "uploads")
    os.makedirs(upload_dir, exist_ok=True)

    # Patch module-level singletons BEFORE the lifespan (init_db) fires.
    with patch("app.db.database.DB_PATH", db_path), \
         patch("app.services.document_service.UPLOAD_DIR", upload_dir):
        from main import app
        with TestClient(app) as c:
            yield c


# ── Shared helpers ─────────────────────────────────────────────────────────────

def upload_txt(client: TestClient, filename: str, content: str) -> "requests.Response":
    """Upload a .txt file and return the raw Response object."""
    return client.post(
        "/documents",
        files={"file": (filename, content.encode("utf-8"), "text/plain")},
    )


def search(client: TestClient, query: str, top_k: int = 10) -> "requests.Response":
    """POST /search and return the raw Response object."""
    return client.post("/search", json={"query": query, "top_k": top_k})
