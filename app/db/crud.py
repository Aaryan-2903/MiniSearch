"""
db/crud.py
----------
All SQL queries live here.  Services call these functions; they never write SQL
themselves.  Each function opens its own connection via get_db() and closes it
when done — keeping connections short-lived and thread-safe.

Grouped sections:
    1. Documents
    2. Postings
    3. Index Meta
"""

import json
from typing import Dict, List, Optional

from app.db.database import get_db


# ── 1. Documents ───────────────────────────────────────────────────────────────

def insert_document(
    filename: str,
    filepath: str,
    file_size: int,
    token_count: int,
    uploaded_at: str,
) -> int:
    """Insert a new document row and return the new primary key."""
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO documents (filename, filepath, file_size, token_count, uploaded_at)
               VALUES (?, ?, ?, ?, ?)""",
            (filename, filepath, file_size, token_count, uploaded_at),
        )
        return cursor.lastrowid  # type: ignore[return-value]


def update_document_filepath(doc_id: int, filepath: str) -> None:
    """Update the filepath column after the physical file has been saved."""
    with get_db() as conn:
        conn.execute(
            "UPDATE documents SET filepath = ? WHERE id = ?",
            (filepath, doc_id),
        )


def get_all_documents() -> List[dict]:
    """Return all documents ordered by upload date (newest first)."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM documents ORDER BY uploaded_at DESC"
        ).fetchall()
        return [dict(row) for row in rows]


def get_document_by_id(doc_id: int) -> Optional[dict]:
    """Return a single document dict, or None if not found."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM documents WHERE id = ?", (doc_id,)
        ).fetchone()
        return dict(row) if row else None


def delete_document(doc_id: int) -> None:
    """
    Delete a document row.
    The postings rows are removed automatically via ON DELETE CASCADE.
    """
    with get_db() as conn:
        conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))


def get_total_document_count() -> int:
    """Return the total number of documents in the corpus."""
    with get_db() as conn:
        return conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0]


# ── 2. Postings ────────────────────────────────────────────────────────────────

def insert_postings(doc_id: int, term_data: Dict[str, dict]) -> None:
    """
    Bulk-insert postings for one document.

    Args:
        doc_id:    The document's primary key.
        term_data: { term: {"tf": int, "positions": [int, ...]} }
                   as returned by preprocessor.preprocess_with_positions().
    """
    rows = [
        (term, doc_id, data["tf"], json.dumps(data["positions"]))
        for term, data in term_data.items()
    ]
    with get_db() as conn:
        conn.executemany(
            "INSERT INTO postings (term, doc_id, term_frequency, positions) VALUES (?, ?, ?, ?)",
            rows,
        )


def delete_postings_for_doc(doc_id: int) -> None:
    """Remove all postings for a specific document (used during rebuild)."""
    with get_db() as conn:
        conn.execute("DELETE FROM postings WHERE doc_id = ?", (doc_id,))


def delete_all_postings() -> None:
    """Wipe the entire postings table (called before a full index rebuild)."""
    with get_db() as conn:
        conn.execute("DELETE FROM postings")


def get_postings_for_terms(terms: List[str]) -> Dict[str, list]:
    """
    Fetch posting lists for all given terms in a single query.

    Returns:
        { term: [ {"doc_id": int, "tf": int, "positions": [int, ...]}, ... ] }
    """
    if not terms:
        return {}

    placeholders = ",".join("?" * len(terms))
    with get_db() as conn:
        rows = conn.execute(
            f"SELECT term, doc_id, term_frequency, positions "
            f"FROM postings WHERE term IN ({placeholders})",
            terms,
        ).fetchall()

    result: Dict[str, list] = {}
    for row in rows:
        term = row["term"]
        result.setdefault(term, []).append({
            "doc_id": row["doc_id"],
            "tf": row["term_frequency"],
            "positions": json.loads(row["positions"]),
        })
    return result


def get_unique_term_count() -> int:
    """Return the number of distinct terms across the entire index."""
    with get_db() as conn:
        return conn.execute(
            "SELECT COUNT(DISTINCT term) FROM postings"
        ).fetchone()[0]


# ── 3. Index Meta ──────────────────────────────────────────────────────────────

def get_index_meta() -> dict:
    """Return the single index_meta row as a dict."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM index_meta WHERE id = 1").fetchone()
        return dict(row)


def update_index_meta(
    total_documents: int,
    total_unique_terms: int,
    last_built_at: str,
    index_status: str,
) -> None:
    """Update all fields of the index_meta singleton row."""
    with get_db() as conn:
        conn.execute(
            """UPDATE index_meta
               SET total_documents    = ?,
                   total_unique_terms = ?,
                   last_built_at      = ?,
                   index_status       = ?
               WHERE id = 1""",
            (total_documents, total_unique_terms, last_built_at, index_status),
        )


def set_index_status(status: str) -> None:
    """Quickly flip the index_status field (e.g. to 'building' before a rebuild)."""
    with get_db() as conn:
        conn.execute(
            "UPDATE index_meta SET index_status = ? WHERE id = 1",
            (status,),
        )
