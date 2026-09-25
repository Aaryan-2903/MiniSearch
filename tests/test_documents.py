"""
tests/test_documents.py
-----------------------
Validates requirements 1–4 and 9:
  1.  Uploading multiple .txt files works.
  2.  Duplicate filenames are handled safely.
  3.  Empty files are handled safely (rejected).
  4.  Non-.txt files are rejected.
  9.  Deleting a document removes its postings from the inverted index.
"""

from tests.conftest import upload_txt, search


# ── Listing ────────────────────────────────────────────────────────────────────

def test_list_documents_initially_empty(client):
    """Before any upload the document list must be empty."""
    r = client.get("/documents")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 0
    assert body["documents"] == []


# ── Upload ─────────────────────────────────────────────────────────────────────

def test_upload_single_file(client):
    """A valid .txt upload returns 201 with correct metadata."""
    r = upload_txt(client, "hello.txt", "Hello world from MiniSearch.")
    assert r.status_code == 201
    doc = r.json()
    assert doc["id"] >= 1
    assert doc["filename"] == "hello.txt"
    assert doc["file_size"] > 0
    assert doc["token_count"] > 0
    assert "uploaded_at" in doc


def test_upload_multiple_files(client):
    """
    Requirement 1 — uploading N files yields N distinct documents.
    All N must appear in the listing with unique IDs.
    """
    texts = [
        ("doc_a.txt", "Python is a high-level programming language."),
        ("doc_b.txt", "Machine learning automates analytical model building."),
        ("doc_c.txt", "Information retrieval ranks documents by relevance."),
    ]
    ids = set()
    for filename, content in texts:
        r = upload_txt(client, filename, content)
        assert r.status_code == 201, f"Upload failed for {filename}: {r.text}"
        ids.add(r.json()["id"])

    # All IDs must be distinct.
    assert len(ids) == 3

    # All three appear in the listing.
    listing = client.get("/documents").json()
    assert listing["total"] == 3


def test_duplicate_filenames_get_separate_ids(client):
    """
    Requirement 2 — uploading the same filename twice must not overwrite.
    Both documents should exist with different IDs.
    """
    r1 = upload_txt(client, "report.txt", "First version of the report.")
    r2 = upload_txt(client, "report.txt", "Second version of the report.")

    assert r1.status_code == 201
    assert r2.status_code == 201

    id1 = r1.json()["id"]
    id2 = r2.json()["id"]
    assert id1 != id2

    listing = client.get("/documents").json()
    assert listing["total"] == 2


# ── Rejection ──────────────────────────────────────────────────────────────────

def test_empty_file_rejected(client):
    """Requirement 3 — an empty .txt file must be rejected with HTTP 400."""
    r = client.post(
        "/documents",
        files={"file": ("empty.txt", b"", "text/plain")},
    )
    assert r.status_code == 400
    assert "detail" in r.json()


def test_non_txt_pdf_rejected(client):
    """Requirement 4 — a .pdf file must be rejected with HTTP 400."""
    r = client.post(
        "/documents",
        files={"file": ("paper.pdf", b"PDF content", "application/pdf")},
    )
    assert r.status_code == 400
    assert "detail" in r.json()


def test_non_txt_no_extension_rejected(client):
    """A file with no extension must be rejected with HTTP 400."""
    r = client.post(
        "/documents",
        files={"file": ("README", b"Some content", "text/plain")},
    )
    assert r.status_code == 400
    assert "detail" in r.json()


def test_non_txt_docx_rejected(client):
    """A .docx file must be rejected with HTTP 400."""
    r = client.post(
        "/documents",
        files={"file": ("report.docx", b"DOCX binary", "application/vnd.openxmlformats")},
    )
    assert r.status_code == 400
    assert "detail" in r.json()


# ── Deletion ───────────────────────────────────────────────────────────────────

def test_delete_document_returns_204(client):
    """Deleting an existing document returns HTTP 204."""
    doc_id = upload_txt(client, "to_delete.txt", "This document will be deleted.").json()["id"]
    r = client.delete(f"/documents/{doc_id}")
    assert r.status_code == 204


def test_deleted_document_not_in_listing(client):
    """After deletion the document must no longer appear in GET /documents."""
    doc_id = upload_txt(client, "gone.txt", "Gone document.").json()["id"]
    client.delete(f"/documents/{doc_id}")

    listing = client.get("/documents").json()
    ids_in_listing = [d["id"] for d in listing["documents"]]
    assert doc_id not in ids_in_listing


def test_delete_nonexistent_returns_404(client):
    """Deleting a document that does not exist must return HTTP 404."""
    r = client.delete("/documents/99999")
    assert r.status_code == 404
    assert "detail" in r.json()


def test_delete_removes_postings_from_index(client):
    """
    Requirement 9 — after a document is deleted, searching for its unique
    terms must return no results.
    """
    unique_term = "zephyrtermunique"
    doc_id = upload_txt(
        client, "unique.txt", f"The {unique_term} appears only in this document."
    ).json()["id"]

    # Confirm it's searchable before deletion.
    results_before = search(client, unique_term).json()["results"]
    assert any(r["doc_id"] == doc_id for r in results_before), \
        "Document should be found before deletion"

    # Delete it.
    client.delete(f"/documents/{doc_id}")

    # Must not appear in search results afterwards.
    results_after = search(client, unique_term).json()["results"]
    assert all(r["doc_id"] != doc_id for r in results_after), \
        "Deleted document must not appear in search results"
    assert len(results_after) == 0
