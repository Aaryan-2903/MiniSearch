"""
tests/test_settings.py
----------------------
Comprehensive test suite for engine settings:
- GET /settings
- updating case sensitivity
- updating stopword filtering
- updating default search semantics
- updating maximum file size
- persistence after reopening/reinitializing the application
- upload respecting configured maximum file size
- case sensitivity actually affecting preprocessing/indexing
- stopword filtering actually affecting indexing
- rebuild applying changed preprocessing settings
- rebuild-required state behavior where applicable
- invalid setting values being rejected
"""

from unittest.mock import patch
from fastapi.testclient import TestClient

from tests.conftest import upload_txt, search


def test_get_settings_defaults(client):
    """GET /settings returns expected default values and read-only attributes."""
    r = client.get("/settings")
    assert r.status_code == 200
    data = r.json()
    assert data["case_sensitive"] is False
    assert data["stop_words_enabled"] is True
    assert data["default_search_mode"] == "any"
    assert data["max_file_size_mb"] == 5
    assert data["ranking_algorithm"] == "TF-IDF"
    assert data["accepted_file_types"] == [".txt"]
    assert data["rebuild_required"] is False


def test_update_case_sensitivity(client):
    """PATCH /settings updating case_sensitive returns 200 and sets rebuild_required."""
    r = client.patch("/settings", json={"case_sensitive": True})
    assert r.status_code == 200
    data = r.json()
    assert data["case_sensitive"] is True
    assert data["rebuild_required"] is True

    # Persists to subsequent GET
    get_res = client.get("/settings")
    assert get_res.status_code == 200
    assert get_res.json()["case_sensitive"] is True
    assert get_res.json()["rebuild_required"] is True


def test_update_stopword_filtering(client):
    """PATCH /settings updating stop_words_enabled returns 200 and sets rebuild_required."""
    r = client.patch("/settings", json={"stop_words_enabled": False})
    assert r.status_code == 200
    data = r.json()
    assert data["stop_words_enabled"] is False
    assert data["rebuild_required"] is True

    # Persists to subsequent GET
    get_res = client.get("/settings")
    assert get_res.status_code == 200
    assert get_res.json()["stop_words_enabled"] is False
    assert get_res.json()["rebuild_required"] is True


def test_update_default_search_semantics(client):
    """
    PATCH /settings updating default_search_mode to 'all' works without requiring rebuild,
    and search defaults to 'all' when match_mode is not explicitly passed.
    """
    r = client.patch("/settings", json={"default_search_mode": "all"})
    assert r.status_code == 200
    data = r.json()
    assert data["default_search_mode"] == "all"
    assert data["rebuild_required"] is False

    # Upload two docs:
    upload_txt(client, "doc1.txt", "apple banana orange")
    upload_txt(client, "doc2.txt", "apple banana pear")

    # Search with two terms without match_mode:
    # Query "orange pear": in 'all' mode, no document contains BOTH orange and pear
    res_all_default = client.post("/search", json={"query": "orange pear"}).json()
    assert res_all_default["match_mode"] == "all"
    assert res_all_default["total_results"] == 0

    # Explicit match_mode="any" override still works
    res_any_override = client.post("/search", json={"query": "orange pear", "match_mode": "any"}).json()
    assert res_any_override["match_mode"] == "any"
    assert res_any_override["total_results"] == 2


def test_update_max_file_size(client):
    """PATCH /settings updating max_file_size_mb works and does not require rebuild."""
    r = client.patch("/settings", json={"max_file_size_mb": 10})
    assert r.status_code == 200
    data = r.json()
    assert data["max_file_size_mb"] == 10
    assert data["rebuild_required"] is False

    get_res = client.get("/settings")
    assert get_res.status_code == 200
    assert get_res.json()["max_file_size_mb"] == 10


def test_persistence_across_application_reopen(tmp_path):
    """Settings must persist in the SQLite database across application re-initialization."""
    db_path = str(tmp_path / "persist.db")
    upload_dir = str(tmp_path / "uploads")

    with patch("app.db.database.DB_PATH", db_path), \
         patch("app.services.document_service.UPLOAD_DIR", upload_dir):
        from main import app
        # Session 1: Update settings
        with TestClient(app) as c1:
            r1 = c1.patch("/settings", json={
                "case_sensitive": True,
                "stop_words_enabled": False,
                "default_search_mode": "all",
                "max_file_size_mb": 12,
            })
            assert r1.status_code == 200

        # Session 2: New client simulating app restart
        with TestClient(app) as c2:
            r2 = c2.get("/settings")
            assert r2.status_code == 200
            data = r2.json()
            assert data["case_sensitive"] is True
            assert data["stop_words_enabled"] is False
            assert data["default_search_mode"] == "all"
            assert data["max_file_size_mb"] == 12


def test_upload_respecting_configured_max_file_size(client):
    """Upload endpoint must enforce the dynamic max_file_size_mb limit."""
    # Set limit to 1 MB
    r_patch = client.patch("/settings", json={"max_file_size_mb": 1})
    assert r_patch.status_code == 200

    # 1.2 MB file exceeds 1 MB limit
    large_content = "a" * (1200 * 1024)
    r_fail = client.post(
        "/documents",
        files={"file": ("large.txt", large_content.encode("utf-8"), "text/plain")},
    )
    assert r_fail.status_code == 413
    assert "File exceeds the maximum allowed size of 1 MB." in r_fail.json()["detail"]

    # Raise limit to 2 MB
    client.patch("/settings", json={"max_file_size_mb": 2})

    # Same file now succeeds
    r_success = client.post(
        "/documents",
        files={"file": ("large.txt", large_content.encode("utf-8"), "text/plain")},
    )
    assert r_success.status_code == 201


def test_case_sensitivity_affecting_indexing_and_search(client):
    """
    Changing case_sensitive and rebuilding index must preserve token casing
    in postings and search queries.
    """
    upload_txt(client, "tech.txt", "Rust and Python with FastApi and FASTAPI")

    # Initially case_sensitive=False:
    # "FastApi" and "FASTAPI" both fold to "fastapi"
    res1 = search(client, "FASTAPI").json()
    assert res1["total_results"] == 1
    assert "fastapi" in res1["results"][0]["matched_terms"]

    # Now turn on case sensitivity
    client.patch("/settings", json={"case_sensitive": True})
    # Rebuild index to apply new setting
    rebuild_res = client.post("/index/rebuild")
    assert rebuild_res.status_code == 200

    # Search with exact case "FastApi"
    res_exact = search(client, "FastApi").json()
    assert res_exact["total_results"] == 1
    assert "FastApi" in res_exact["results"][0]["matched_terms"]

    # Search with exact case "FASTAPI"
    res_caps = search(client, "FASTAPI").json()
    assert res_caps["total_results"] == 1
    assert "FASTAPI" in res_caps["results"][0]["matched_terms"]

    # Search with lowercase "fastapi" does not match since all occurrences are uppercase/mixed
    res_lower = search(client, "fastapi").json()
    assert res_lower["total_results"] == 0


def test_stopword_filtering_affecting_indexing_and_search(client):
    """
    Disabling stopword filtering and rebuilding index must retain common English stopwords
    in postings and enable searching for them.
    """
    upload_txt(client, "doc.txt", "To be or not to be that is the question")

    # With stop_words_enabled=True (default), searching for "the" yields 0 results
    res_before = search(client, "the").json()
    assert res_before["total_results"] == 0

    # Disable stopword filtering
    patch_res = client.patch("/settings", json={"stop_words_enabled": False})
    assert patch_res.status_code == 200
    assert patch_res.json()["rebuild_required"] is True

    # Rebuild index
    rebuild_res = client.post("/index/rebuild")
    assert rebuild_res.status_code == 200

    # Stopwords like "the", "not", "that", "is" are now indexed and searchable
    res_after = search(client, "the").json()
    assert res_after["total_results"] == 1
    assert "the" in res_after["results"][0]["matched_terms"]

    res_not = search(client, "not").json()
    assert res_not["total_results"] == 1
    assert "not" in res_not["results"][0]["matched_terms"]


def test_rebuild_applying_changed_preprocessing_settings(client):
    """Index statistics and postings update accurately when settings change and rebuild runs."""
    upload_txt(client, "sample.txt", "The quick brown fox jumps over the lazy dog")

    stats_initial = client.get("/index/stats").json()
    initial_terms = stats_initial["total_unique_terms"]

    # Turn off stopword filtering -> unique terms count should increase after rebuild
    client.patch("/settings", json={"stop_words_enabled": False})
    client.post("/index/rebuild")

    stats_after_stop = client.get("/index/stats").json()
    assert stats_after_stop["total_unique_terms"] > initial_terms


def test_rebuild_required_state_behavior(client):
    """
    rebuild_required transitions to True when case_sensitive or stop_words_enabled changes,
    returns to False if reverted to indexed value, and clears to False upon index rebuild.
    Non-indexing settings (search mode, max size) do NOT require rebuild.
    """
    upload_txt(client, "base.txt", "Sample base document content.")

    settings = client.get("/settings").json()
    assert settings["rebuild_required"] is False

    # Changing non-indexing settings leaves rebuild_required as False
    r1 = client.patch("/settings", json={"default_search_mode": "all", "max_file_size_mb": 8})
    assert r1.json()["rebuild_required"] is False

    # Changing case_sensitive triggers rebuild_required
    r2 = client.patch("/settings", json={"case_sensitive": True})
    assert r2.json()["rebuild_required"] is True

    # Reverting case_sensitive back to indexed value (False) clears rebuild_required
    r3 = client.patch("/settings", json={"case_sensitive": False})
    assert r3.json()["rebuild_required"] is False

    # Changing stop_words_enabled triggers rebuild_required
    r4 = client.patch("/settings", json={"stop_words_enabled": False})
    assert r4.json()["rebuild_required"] is True

    # Updating max_file_size while rebuild is required preserves rebuild_required=True
    r5 = client.patch("/settings", json={"max_file_size_mb": 15})
    assert r5.json()["rebuild_required"] is True

    # Rebuilding index clears rebuild_required
    client.post("/index/rebuild")
    r6 = client.get("/settings")
    assert r6.json()["rebuild_required"] is False


def test_invalid_setting_values_rejected(client):
    """Invalid setting payloads return appropriate error status codes with detail field."""
    # Empty body
    r_empty = client.patch("/settings", json={})
    assert r_empty.status_code == 400
    assert "detail" in r_empty.json()

    # max_file_size_mb below minimum (ge=1)
    r_zero_mb = client.patch("/settings", json={"max_file_size_mb": 0})
    assert r_zero_mb.status_code == 422
    assert "detail" in r_zero_mb.json()

    # max_file_size_mb above maximum (le=50)
    r_huge_mb = client.patch("/settings", json={"max_file_size_mb": 51})
    assert r_huge_mb.status_code == 422
    assert "detail" in r_huge_mb.json()

    # Invalid default_search_mode
    r_invalid_mode = client.patch("/settings", json={"default_search_mode": "fuzzy"})
    assert r_invalid_mode.status_code == 422
    assert "detail" in r_invalid_mode.json()

    # Invalid type for boolean
    r_bad_bool = client.patch("/settings", json={"case_sensitive": "not_a_bool"})
    assert r_bad_bool.status_code == 422
    assert "detail" in r_bad_bool.json()

    # Attempt to change read-only or extra field
    r_extra = client.patch("/settings", json={"ranking_algorithm": "BM25"})
    assert r_extra.status_code == 422
    assert "detail" in r_extra.json()
