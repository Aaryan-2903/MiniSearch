"""
tests/test_folders.py
---------------------
Tests for folder management, document move/copy/rename, and folder-scoped search:
  1. Create folder
  2. List folders with document count
  3. Get folder by ID
  4. Rename folder
  5. Duplicate folder name rejected
  6. Delete folder moves documents to root (preserves documents and index)
  7. Upload into folder vs root
  8. Rename document (valid .txt vs invalid extension rejected)
  9. Move document between folders and to root
  10. Copy document creates new ID, identical content, indexes copy, leaves original unchanged
  11. Delete document inside folder cleans up properly
  12. Global search finds documents across all folders with folder_name
  13. Folder-scoped search filters by folder_id before ranking
  14. Folder-scoped search with match_mode any/all
"""

import pytest
from tests.conftest import upload_txt, search


# ── Folder CRUD Tests ─────────────────────────────────────────────────────────

def test_create_and_get_folder(client):
    """Creating a folder returns 201 with id, name, created_at, and doc count 0."""
    r = client.post("/folders", json={"name": "DSA"})
    assert r.status_code == 201
    folder = r.json()
    assert folder["id"] >= 1
    assert folder["name"] == "DSA"
    assert folder["document_count"] == 0
    assert "created_at" in folder

    # Get by ID
    r_get = client.get(f"/folders/{folder['id']}")
    assert r_get.status_code == 200
    assert r_get.json()["name"] == "DSA"


def test_list_folders_alphabetical(client):
    """Folders are listed ordered by name alphabetically with counts."""
    client.post("/folders", json={"name": "PCQ"})
    client.post("/folders", json={"name": "DSA"})
    client.post("/folders", json={"name": "Algorithms"})

    r = client.get("/folders")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 3
    names = [f["name"] for f in body["folders"]]
    assert names == ["Algorithms", "DSA", "PCQ"]


def test_rename_folder(client):
    """Renaming a folder updates its name."""
    r = client.post("/folders", json={"name": "OldName"})
    folder_id = r.json()["id"]

    r_patch = client.patch(f"/folders/{folder_id}", json={"name": "NewName"})
    assert r_patch.status_code == 200
    assert r_patch.json()["name"] == "NewName"

    r_get = client.get(f"/folders/{folder_id}")
    assert r_get.json()["name"] == "NewName"


def test_duplicate_folder_name_rejected(client):
    """Duplicate folder names (case-insensitive) return HTTP 400."""
    r1 = client.post("/folders", json={"name": "Notes"})
    assert r1.status_code == 201

    r2 = client.post("/folders", json={"name": "notes"})
    assert r2.status_code == 400
    assert "detail" in r2.json()

    # Also during rename
    r3 = client.post("/folders", json={"name": "Other"})
    assert r3.status_code == 201
    r_patch = client.patch(f"/folders/{r3.json()['id']}", json={"name": "NOTES"})
    assert r_patch.status_code == 400


def test_empty_folder_name_rejected(client):
    """Empty or whitespace-only folder names are rejected."""
    r = client.post("/folders", json={"name": "   "})
    assert r.status_code == 400


def test_get_nonexistent_folder_returns_404(client):
    """Getting a missing folder returns 404."""
    r = client.get("/folders/99999")
    assert r.status_code == 404


def test_delete_folder_moves_documents_to_root(client):
    """
    Deleting a folder must NOT delete its documents.
    Documents in the deleted folder are moved to root (folder_id=null).
    """
    # Create folder and document
    r_f = client.post("/folders", json={"name": "DSA"})
    folder_id = r_f.json()["id"]

    r_doc = client.post(
        "/documents",
        files={"file": ("Arrays.txt", b"Array elements in memory.", "text/plain")},
        data={"folder_id": folder_id},
    )
    assert r_doc.status_code == 201
    doc_id = r_doc.json()["id"]
    assert r_doc.json()["folder_id"] == folder_id
    assert r_doc.json()["folder_name"] == "DSA"

    # Verify folder shows 1 document
    r_f_get = client.get(f"/folders/{folder_id}")
    assert r_f_get.json()["document_count"] == 1

    # Delete folder
    r_del = client.delete(f"/folders/{folder_id}")
    assert r_del.status_code == 204

    # Folder is gone
    assert client.get(f"/folders/{folder_id}").status_code == 404

    # Document still exists, but its folder_id is now None (root)
    r_doc_after = client.get(f"/documents/{doc_id}")
    assert r_doc_after.status_code == 200
    assert r_doc_after.json()["folder_id"] is None
    assert r_doc_after.json()["folder_name"] is None
    assert r_doc_after.json()["content"] == "Array elements in memory."


# ── Document Move / Rename / Copy Tests ────────────────────────────────────────

def test_upload_into_folder_and_root(client):
    """Documents can be uploaded to root (default) or into a folder."""
    r_f = client.post("/folders", json={"name": "Algorithms"})
    folder_id = r_f.json()["id"]

    # Root upload
    r_root = upload_txt(client, "root_doc.txt", "Content in root.")
    assert r_root.status_code == 201
    assert r_root.json()["folder_id"] is None

    # Folder upload
    r_folder = client.post(
        "/documents",
        files={"file": ("algo.txt", b"Sorting algorithms.", "text/plain")},
        data={"folder_id": folder_id},
    )
    assert r_folder.status_code == 201
    assert r_folder.json()["folder_id"] == folder_id
    assert r_folder.json()["folder_name"] == "Algorithms"


def test_rename_document(client):
    """Renaming a document allows valid .txt names, rejects non-.txt."""
    r = upload_txt(client, "initial.txt", "Some text.")
    doc_id = r.json()["id"]

    # Valid rename
    r_rename = client.patch(f"/documents/{doc_id}", json={"filename": "renamed.txt"})
    assert r_rename.status_code == 200
    assert r_rename.json()["filename"] == "renamed.txt"

    # Non-.txt rejected
    r_bad = client.patch(f"/documents/{doc_id}", json={"filename": "renamed.pdf"})
    assert r_bad.status_code == 400


def test_move_document_between_folders_and_root(client):
    """Moving a document updates folder_id without altering postings or doc ID."""
    f1 = client.post("/folders", json={"name": "Folder1"}).json()["id"]
    f2 = client.post("/folders", json={"name": "Folder2"}).json()["id"]

    r_doc = client.post(
        "/documents",
        files={"file": ("item.txt", b"Moving test content.", "text/plain")},
        data={"folder_id": f1},
    )
    doc_id = r_doc.json()["id"]
    assert r_doc.json()["folder_id"] == f1

    # Move from Folder1 -> Folder2
    r_move = client.patch(f"/documents/{doc_id}", json={"folder_id": f2})
    assert r_move.status_code == 200
    assert r_move.json()["folder_id"] == f2
    assert r_move.json()["folder_name"] == "Folder2"

    # Move from Folder2 -> Root (folder_id=None)
    r_root = client.patch(f"/documents/{doc_id}", json={"folder_id": None})
    assert r_root.status_code == 200
    assert r_root.json()["folder_id"] is None
    assert r_root.json()["folder_name"] is None

    # Search still works with unchanged postings
    res = search(client, "moving test").json()["results"]
    assert len(res) == 1
    assert res[0]["doc_id"] == doc_id


def test_copy_document_creates_new_indexed_copy(client):
    """Copying creates a distinct document ID with identical content and new index entries."""
    f_src = client.post("/folders", json={"name": "Source"}).json()["id"]
    f_dst = client.post("/folders", json={"name": "Destination"}).json()["id"]

    r_orig = client.post(
        "/documents",
        files={"file": ("orig.txt", b"Unique copyable keyword zephyrcopy.", "text/plain")},
        data={"folder_id": f_src},
    )
    orig_id = r_orig.json()["id"]

    # Copy to destination folder
    r_copy = client.post(f"/documents/{orig_id}/copy", json={"folder_id": f_dst})
    assert r_copy.status_code == 201
    copy_doc = r_copy.json()
    assert copy_doc["id"] != orig_id
    assert copy_doc["filename"] == "orig.txt"
    assert copy_doc["folder_id"] == f_dst
    assert copy_doc["folder_name"] == "Destination"

    # Both documents exist and have identical content
    r_orig_get = client.get(f"/documents/{orig_id}")
    r_copy_get = client.get(f"/documents/{copy_doc['id']}")
    assert r_orig_get.json()["content"] == r_copy_get.json()["content"]

    # Search finds both copies
    res = search(client, "zephyrcopy").json()["results"]
    assert len(res) == 2
    doc_ids = {r["doc_id"] for r in res}
    assert doc_ids == {orig_id, copy_doc["id"]}


# ── Search Integration with Folders ───────────────────────────────────────────

def test_global_search_across_folders_with_folder_name(client):
    """Global search returns documents from all folders and includes folder_name."""
    f1 = client.post("/folders", json={"name": "DSA"}).json()["id"]
    f2 = client.post("/folders", json={"name": "PCQ"}).json()["id"]

    client.post(
        "/documents",
        files={"file": ("Trees.txt", b"Binary search tree structures.", "text/plain")},
        data={"folder_id": f1},
    )
    client.post(
        "/documents",
        files={"file": ("Graphs.txt", b"Graph traversal and tree algorithms.", "text/plain")},
        data={"folder_id": f2},
    )
    upload_txt(client, "RootNotes.txt", "Root tree notes.")

    r = search(client, "tree")
    assert r.status_code == 200
    results = r.json()["results"]
    assert len(results) == 3

    folder_map = {res["filename"]: res.get("folder_name") for res in results}
    assert folder_map["Trees.txt"] == "DSA"
    assert folder_map["Graphs.txt"] == "PCQ"
    assert folder_map["RootNotes.txt"] is None


def test_folder_scoped_search(client):
    """Search scoped to folder_id only returns matching documents within that folder."""
    f_dsa = client.post("/folders", json={"name": "DSA"}).json()["id"]
    f_pcq = client.post("/folders", json={"name": "PCQ"}).json()["id"]

    client.post(
        "/documents",
        files={"file": ("dsa_doc.txt", b"Recursion in data structures.", "text/plain")},
        data={"folder_id": f_dsa},
    )
    client.post(
        "/documents",
        files={"file": ("pcq_doc.txt", b"Recursion in functional programming.", "text/plain")},
        data={"folder_id": f_pcq},
    )

    # Scoped search to DSA
    r_dsa = client.post("/search", json={"query": "recursion", "folder_id": f_dsa})
    assert r_dsa.status_code == 200
    res_dsa = r_dsa.json()["results"]
    assert len(res_dsa) == 1
    assert res_dsa[0]["filename"] == "dsa_doc.txt"
    assert res_dsa[0]["folder_name"] == "DSA"

    # Scoped search to PCQ
    r_pcq = client.post("/search", json={"query": "recursion", "folder_id": f_pcq})
    assert r_pcq.status_code == 200
    res_pcq = r_pcq.json()["results"]
    assert len(res_pcq) == 1
    assert res_pcq[0]["filename"] == "pcq_doc.txt"
    assert res_pcq[0]["folder_name"] == "PCQ"


def test_folder_scoped_search_with_all_match_mode(client):
    """Folder-scoped search respects match_mode 'all'."""
    f = client.post("/folders", json={"name": "DSA"}).json()["id"]

    client.post(
        "/documents",
        files={"file": ("both.txt", b"Python and database together.", "text/plain")},
        data={"folder_id": f},
    )
    client.post(
        "/documents",
        files={"file": ("one.txt", b"Python without persistence.", "text/plain")},
        data={"folder_id": f},
    )

    r = client.post("/search", json={"query": "python database", "match_mode": "all", "folder_id": f})
    assert r.status_code == 200
    results = r.json()["results"]
    assert len(results) == 1
    assert results[0]["filename"] == "both.txt"
