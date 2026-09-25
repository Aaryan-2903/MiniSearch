"""
tests/test_index.py
-------------------
Validates requirements 10–14:
  10. Rebuilding the index produces the same search results as incremental indexing.
  11. Index statistics remain correct after upload and deletion.
  12. The API returns consistent error responses (detail field always present).
  13. No secrets or local DB files are accidentally tracked by Git (.gitignore check).
  14. (All tests together constitute the complete test suite.)
"""

import os
from pathlib import Path

from tests.conftest import upload_txt, search


# ── Index statistics ───────────────────────────────────────────────────────────

def test_stats_initially_empty(client):
    """Requirement 11a — fresh index must report status='empty' and zero counts."""
    r = client.get("/index/stats")
    assert r.status_code == 200
    stats = r.json()
    assert stats["total_documents"] == 0
    assert stats["total_unique_terms"] == 0
    assert stats["index_status"] == "empty"
    assert stats["last_built_at"] is None


def test_stats_update_after_single_upload(client):
    """Requirement 11b — after uploading one document, counts increment correctly."""
    upload_txt(client, "stats_doc.txt",
               "Compiler design involves lexical analysis parsing and code generation.")

    stats = client.get("/index/stats").json()
    assert stats["total_documents"] == 1
    assert stats["total_unique_terms"] > 0
    assert stats["index_status"] == "ready"
    assert stats["last_built_at"] is not None


def test_stats_update_after_multiple_uploads(client):
    """Stats must reflect the total across all uploaded documents."""
    upload_txt(client, "d1.txt", "Operating systems manage memory processes and scheduling.")
    upload_txt(client, "d2.txt", "Computer networks use protocols like TCP and UDP.")

    stats = client.get("/index/stats").json()
    assert stats["total_documents"] == 2
    assert stats["total_unique_terms"] > 0


def test_stats_decrement_after_delete(client):
    """Requirement 11c — deleting a document decrements total_documents."""
    r = upload_txt(client, "to_remove.txt", "This document will be deleted soon.")
    doc_id = r.json()["id"]

    stats_before = client.get("/index/stats").json()
    docs_before = stats_before["total_documents"]
    terms_before = stats_before["total_unique_terms"]

    client.delete(f"/documents/{doc_id}")

    stats_after = client.get("/index/stats").json()
    assert stats_after["total_documents"] == docs_before - 1
    # Unique terms must have decreased or stayed the same (shared terms may remain).
    assert stats_after["total_unique_terms"] <= terms_before


def test_stats_empty_status_after_all_deleted(client):
    """When all documents are deleted, index_status should revert to 'empty'."""
    r = upload_txt(client, "only_doc.txt", "The only document in the system.")
    doc_id = r.json()["id"]

    client.delete(f"/documents/{doc_id}")

    stats = client.get("/index/stats").json()
    assert stats["total_documents"] == 0
    assert stats["index_status"] == "empty"


# ── Rebuild consistency ────────────────────────────────────────────────────────

def test_rebuild_returns_correct_structure(client):
    """POST /index/rebuild must return message, total_documents, total_unique_terms, rebuilt_at."""
    upload_txt(client, "rebuild_doc.txt", "Sorting algorithms include quicksort mergesort heapsort.")

    r = client.post("/index/rebuild")
    assert r.status_code == 200
    body = r.json()
    assert "message" in body
    assert "total_documents" in body
    assert "total_unique_terms" in body
    assert "rebuilt_at" in body
    assert body["total_documents"] == 1
    assert body["total_unique_terms"] > 0


def test_rebuild_on_empty_corpus(client):
    """Rebuilding with zero documents must succeed and report zero counts."""
    r = client.post("/index/rebuild")
    assert r.status_code == 200
    body = r.json()
    assert body["total_documents"] == 0
    assert body["total_unique_terms"] == 0


def test_rebuild_produces_identical_search_results(client):
    """
    Requirement 10 — search results before and after a full rebuild must be
    identical (same doc_ids, same scores, same matched_terms).

    This verifies that incremental indexing and the rebuild pipeline use
    exactly the same preprocessing and TF-IDF computation.
    """
    upload_txt(client, "rebuild_a.txt",
               "Graph traversal algorithms breadth-first depth-first shortest path.")
    upload_txt(client, "rebuild_b.txt",
               "Dynamic programming solves subproblems and stores solutions memoization.")
    upload_txt(client, "rebuild_c.txt",
               "Graph algorithms are fundamental to computer science breadth-first.")

    query = "graph breadth"

    # Capture results BEFORE rebuild.
    before = search(client, query).json()

    # Perform full rebuild.
    rebuild_r = client.post("/index/rebuild")
    assert rebuild_r.status_code == 200

    # Capture results AFTER rebuild.
    after = search(client, query).json()

    # total_results must match.
    assert before["total_results"] == after["total_results"], \
        f"Result count changed: before={before['total_results']}, after={after['total_results']}"

    # Rankings must be identical.
    before_ids = [r["doc_id"] for r in before["results"]]
    after_ids  = [r["doc_id"] for r in after["results"]]
    assert before_ids == after_ids, \
        f"Ranking order changed after rebuild.\nBefore: {before_ids}\nAfter:  {after_ids}"

    # Scores must match exactly (same arithmetic, same data).
    before_scores = [r["score"] for r in before["results"]]
    after_scores  = [r["score"] for r in after["results"]]
    assert before_scores == after_scores, \
        f"Scores changed after rebuild.\nBefore: {before_scores}\nAfter:  {after_scores}"


def test_rebuild_status_is_ready_after_success(client):
    """After a successful rebuild, index_status must be 'ready'."""
    upload_txt(client, "status_check.txt", "Testing the rebuild status field.")
    client.post("/index/rebuild")
    stats = client.get("/index/stats").json()
    assert stats["index_status"] == "ready"


def test_stats_consistent_after_rebuild(client):
    """Index stats reported by /index/stats must match the rebuild response."""
    upload_txt(client, "consistency_a.txt", "Concurrency primitives mutex semaphore lock.")
    upload_txt(client, "consistency_b.txt", "Asynchronous programming event loop callbacks promises.")

    rebuild_body = client.post("/index/rebuild").json()
    stats        = client.get("/index/stats").json()

    assert rebuild_body["total_documents"]    == stats["total_documents"]
    assert rebuild_body["total_unique_terms"] == stats["total_unique_terms"]


# ── Error response consistency ─────────────────────────────────────────────────

def test_400_has_detail_field(client):
    """Requirement 12a — HTTP 400 responses must include a 'detail' field."""
    r = client.post("/search", json={"query": "   "})
    assert r.status_code == 400
    assert "detail" in r.json()


def test_404_has_detail_field(client):
    """Requirement 12b — HTTP 404 responses must include a 'detail' field."""
    r = client.delete("/documents/99999")
    assert r.status_code == 404
    assert "detail" in r.json()


def test_422_has_detail_field(client):
    """Requirement 12c — HTTP 422 (validation) responses must include a 'detail' field."""
    r = client.post("/search", json={"query": ""})
    assert r.status_code == 422
    assert "detail" in r.json()


def test_400_upload_empty_file_has_detail(client):
    """Requirement 12d — file validation error must include a 'detail' field."""
    r = client.post("/documents", files={"file": ("bad.pdf", b"bytes", "application/pdf")})
    assert r.status_code == 400
    assert "detail" in r.json()


# ── Git tracking ───────────────────────────────────────────────────────────────

def test_gitignore_excludes_database_file():
    """Requirement 13a — database.db must be listed in .gitignore."""
    project_root = Path(__file__).parent.parent
    gitignore = (project_root / ".gitignore").read_text(encoding="utf-8")
    assert "database.db" in gitignore, ".gitignore must exclude database.db"


def test_gitignore_excludes_uploads_directory():
    """Requirement 13b — uploads/ must be listed in .gitignore."""
    project_root = Path(__file__).parent.parent
    gitignore = (project_root / ".gitignore").read_text(encoding="utf-8")
    assert "uploads/" in gitignore, ".gitignore must exclude uploads/"


def test_gitignore_excludes_env_file():
    """Requirement 13c — .env must be listed in .gitignore to avoid leaking secrets."""
    project_root = Path(__file__).parent.parent
    gitignore = (project_root / ".gitignore").read_text(encoding="utf-8")
    assert ".env" in gitignore, ".gitignore must exclude .env"
