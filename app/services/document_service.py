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

from app.core.preprocessor import preprocess_with_positions
from app.db import crud

UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")


def _ensure_upload_dir() -> None:
    os.makedirs(UPLOAD_DIR, exist_ok=True)


def list_documents() -> list:
    """Return all document records ordered by upload date."""
    return crud.get_all_documents()


def upload_document(filename: str, content: bytes) -> dict:
    """
    Full upload pipeline:
        decode → preprocess → insert DB row → save file → insert postings → update meta.

    Returns the newly created document record.
    """
    _ensure_upload_dir()

    # Decode raw bytes to text.
    text = content.decode("utf-8", errors="replace")

    # Preprocess: get { term: {tf, positions} } for indexing.
    term_data = preprocess_with_positions(text)
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

    return crud.get_document_by_id(doc_id)  # type: ignore[return-value]


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
