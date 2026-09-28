"""
services/index_service.py
--------------------------
Handles index statistics retrieval and full index rebuilds.

Rebuild pipeline:
    1. Mark index_status = 'building'.
    2. Clear all postings rows.
    3. Read every document file from disk and preprocess it.
    4. Call core/indexer.build_index() to construct the in-memory inverted index
       (demonstrates the data structure clearly — useful for viva).
    5. Persist all postings back to the DB.
    6. Update index_meta to 'ready'.
"""

from datetime import datetime, timezone

from app.core.preprocessor import preprocess_with_positions
from app.core.indexer import build_index
from app.db import crud


def get_stats() -> dict:
    """Return the current index statistics from the index_meta table."""
    return crud.get_index_meta()


def rebuild() -> dict:
    """
    Completely rebuild the inverted index from scratch.

    Useful when:
    - The index is in an inconsistent state.
    - Stop-word list or preprocessing rules have changed.
    - Documents were modified outside the API.

    Returns a summary dict matching the RebuildResponse schema.
    """
    # Signal that a rebuild is in progress.
    crud.set_index_status("building")

    try:
        # Load active settings
        settings = crud.get_settings()
        case_sensitive = bool(settings.get("case_sensitive", 0))
        stop_words_enabled = bool(settings.get("stop_words_enabled", 1))

        # Step 1: Wipe existing postings.
        crud.delete_all_postings()

        # Step 2: Load all document metadata.
        documents = crud.get_all_documents()

        # Step 3: Preprocess every document on disk using configured settings.
        doc_data = []
        for doc in documents:
            try:
                with open(doc["filepath"], encoding="utf-8") as f:
                    text = f.read()
            except FileNotFoundError:
                # Skip documents whose files are missing (shouldn't happen normally).
                continue

            term_data = preprocess_with_positions(
                text,
                case_sensitive=case_sensitive,
                stop_words_enabled=stop_words_enabled,
            )
            doc_data.append({
                "doc_id": doc["id"],
                "term_data": term_data,
            })

        # Step 4: Build the in-memory inverted index (pure function — no DB).
        # This call demonstrates the classic index structure and is the authoritative
        # source for explaining the algorithm in a viva.
        _index = build_index(doc_data)  # noqa: F841  (kept for explainability)

        # Step 5: Persist postings per document.
        for doc_entry in doc_data:
            if doc_entry["term_data"]:
                crud.insert_postings(doc_entry["doc_id"], doc_entry["term_data"])

        # Step 6: Update index metadata.
        now = datetime.now(timezone.utc).isoformat()
        total_docs = crud.get_total_document_count()
        total_terms = crud.get_unique_term_count()
        status = "ready" if total_docs > 0 else "empty"
        crud.update_index_meta(total_docs, total_terms, now, status)

        # Step 7: Clear rebuild_required flag and record indexed settings.
        crud.mark_rebuild_complete(case_sensitive, stop_words_enabled)

    except Exception:
        crud.set_index_status("error")
        raise

    return {
        "message": "Index rebuilt successfully.",
        "total_documents": total_docs,
        "total_unique_terms": total_terms,
        "rebuilt_at": now,
    }
