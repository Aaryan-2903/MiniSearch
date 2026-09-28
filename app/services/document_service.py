"""
services/document_service.py
-----------------------------
Orchestrates document upload, listing, and deletion.

Responsibilities:
- Save the uploaded file to disk (uploads/<doc_id>.txt).
- Preprocess the document text via core/preprocessor.py.
- Persist document metadata and postings to the DB via crud.py.
- Keep index_meta in sync after every mutation.
"""

import os
from datetime import datetime, timezone
from typing import Optional, List

from app.core.preprocessor import preprocess_with_positions
from app.db import crud

UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")


def _ensure_upload_dir() -> None:
    os.makedirs(UPLOAD_DIR, exist_ok=True)


def list_documents(folder_id: Optional[int] = None) -> list:
    """Return document records ordered by upload date, optionally filtered by folder_id."""
    return crud.get_all_documents(folder_id=folder_id)


def get_document(doc_id: int) -> dict:
    """
    Retrieve a document's metadata and its physical file content.
    Returns None if the document is not found in the DB.
    Raises FileNotFoundError if the DB record exists but the file is missing.
    """
    doc = crud.get_document_by_id(doc_id)
    if not doc:
        return None

    filepath = doc.get("filepath")
    if not filepath or not os.path.exists(filepath):
        raise FileNotFoundError(f"File for document {doc_id} is missing from disk.")

    with open(filepath, "r", encoding="utf-8") as f:
        doc["content"] = f.read()

    return doc


def upload_document(filename: str, content: bytes, folder_id: Optional[int] = None) -> dict:
    """
    Full upload pipeline:
        decode → preprocess → insert DB row → save file → insert postings → update meta.

    Returns the newly created document record.
    """
    if folder_id is not None:
        if not crud.get_folder_by_id(folder_id):
            raise KeyError(f"Folder with id={folder_id} does not exist.")

    _ensure_upload_dir()

    # Decode raw bytes to text.
    text = content.decode("utf-8", errors="replace")

    settings = crud.get_settings()
    case_sensitive = bool(settings.get("case_sensitive", 0))
    stop_words_enabled = bool(settings.get("stop_words_enabled", 1))

    # Preprocess: get { term: {tf, positions} } for indexing.
    term_data = preprocess_with_positions(
        text,
        case_sensitive=case_sensitive,
        stop_words_enabled=stop_words_enabled,
    )
    token_count = sum(data["tf"] for data in term_data.values())
    uploaded_at = datetime.now(timezone.utc).isoformat()

    # Insert document row first to obtain the auto-generated ID.
    # filepath is set to an empty string as a temporary placeholder.
    doc_id = crud.insert_document(
        filename=filename,
        filepath="",
        file_size=len(content),
        token_count=token_count,
        uploaded_at=uploaded_at,
        folder_id=folder_id,
    )

    # Now save the file using the ID as the filename (guarantees uniqueness).
    filepath = os.path.join(UPLOAD_DIR, f"{doc_id}.txt")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(text)

    # Update the filepath column now that we know the path.
    crud.update_document_filepath(doc_id, filepath)

    # Persist postings (the inverted index entries for this document).
    if term_data:
        crud.insert_postings(doc_id, term_data)

    # Keep index_meta accurate.
    _sync_index_meta(uploaded_at)

    # If the corpus has only this document, ensure index settings are marked in sync
    if crud.get_total_document_count() == 1:
        crud.mark_rebuild_complete(case_sensitive, stop_words_enabled)

    return crud.get_document_by_id(doc_id)  # type: ignore[return-value]


def rename_document(doc_id: int, new_filename: str) -> Optional[dict]:
    """
    Rename an existing document.
    Validates that the new filename has a .txt extension.
    Returns None if document does not exist.
    """
    doc = crud.get_document_by_id(doc_id)
    if not doc:
        return None

    clean_name = new_filename.strip()
    if not clean_name.lower().endswith(".txt"):
        raise ValueError("Only plain-text (.txt) files are supported.")

    crud.update_document_filename(doc_id, clean_name)
    return crud.get_document_by_id(doc_id)


def move_document(doc_id: int, folder_id: Optional[int]) -> Optional[dict]:
    """
    Move a document to another folder or to root (folder_id=None).
    Does NOT move physical files or touch the inverted index.
    Returns None if document does not exist.
    """
    doc = crud.get_document_by_id(doc_id)
    if not doc:
        return None

    if folder_id is not None:
        if not crud.get_folder_by_id(folder_id):
            raise KeyError(f"Folder with id={folder_id} does not exist.")

    crud.update_document_folder(doc_id, folder_id)
    return crud.get_document_by_id(doc_id)


def copy_document(doc_id: int, target_folder_id: Optional[int] = None) -> Optional[dict]:
    """
    Copy a document to a target folder (or root).
    Creates a new document record, copies file content on disk, and indexes the copy.
    Original document remains unchanged.
    Returns None if original document does not exist.
    """
    doc = crud.get_document_by_id(doc_id)
    if not doc:
        return None

    if target_folder_id is not None:
        if not crud.get_folder_by_id(target_folder_id):
            raise KeyError(f"Folder with id={target_folder_id} does not exist.")

    filepath = doc.get("filepath")
    if not filepath or not os.path.exists(filepath):
        raise FileNotFoundError(f"File for document {doc_id} is missing from disk.")

    with open(filepath, "rb") as f:
        content_bytes = f.read()

    return upload_document(
        filename=doc["filename"],
        content=content_bytes,
        folder_id=target_folder_id,
    )


def delete_document(doc_id: int) -> bool:
    """
    Delete a document and its postings.
    Returns False if the document does not exist.
    """
    doc = crud.get_document_by_id(doc_id)
    if not doc:
        return False

    # Remove physical file from disk.
    if os.path.exists(doc["filepath"]):
        os.remove(doc["filepath"])

    # Delete DB row — postings are removed by ON DELETE CASCADE.
    crud.delete_document(doc_id)

    # Keep index_meta accurate.
    _sync_index_meta(datetime.now(timezone.utc).isoformat())

    return True


def _sync_index_meta(timestamp: str) -> None:
    """Recount documents and terms, then update the index_meta singleton."""
    total_docs = crud.get_total_document_count()
    total_terms = crud.get_unique_term_count()
    status = "ready" if total_docs > 0 else "empty"
    crud.update_index_meta(total_docs, total_terms, timestamp, status)
