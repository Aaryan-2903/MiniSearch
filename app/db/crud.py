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
    4. Settings
"""

import json
from typing import Dict, List, Optional

from app.db.database import get_db


# ── 1. Folders ─────────────────────────────────────────────────────────────────

def insert_folder(name: str, created_at: str) -> int:
    """Insert a new folder row and return the new primary key."""
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO folders (name, created_at) VALUES (?, ?)",
            (name, created_at),
        )
        return cursor.lastrowid  # type: ignore[return-value]


def get_all_folders() -> List[dict]:
    """Return all folders ordered alphabetically with document counts."""
    with get_db() as conn:
        rows = conn.execute(
            """SELECT f.id, f.name, f.created_at, COUNT(d.id) AS document_count
               FROM folders f
               LEFT JOIN documents d ON d.folder_id = f.id
               GROUP BY f.id
               ORDER BY f.name COLLATE NOCASE ASC"""
        ).fetchall()
        return [dict(row) for row in rows]


def get_folder_by_id(folder_id: int) -> Optional[dict]:
    """Return a single folder dict with document count, or None if not found."""
    with get_db() as conn:
        row = conn.execute(
            """SELECT f.id, f.name, f.created_at, COUNT(d.id) AS document_count
               FROM folders f
               LEFT JOIN documents d ON d.folder_id = f.id
               WHERE f.id = ?
               GROUP BY f.id""",
            (folder_id,),
        ).fetchone()
        return dict(row) if row else None


def get_folder_by_name(name: str) -> Optional[dict]:
    """Return a folder by case-insensitive name, or None if not found."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM folders WHERE LOWER(name) = LOWER(?)",
            (name.strip(),),
        ).fetchone()
        return dict(row) if row else None


def update_folder_name(folder_id: int, name: str) -> None:
    """Update the name of an existing folder."""
    with get_db() as conn:
        conn.execute(
            "UPDATE folders SET name = ? WHERE id = ?",
            (name, folder_id),
        )


def delete_folder(folder_id: int) -> None:
    """
    Delete a folder.
    Documents in this folder are moved to root (folder_id = NULL).
    """
    with get_db() as conn:
        conn.execute("UPDATE documents SET folder_id = NULL WHERE folder_id = ?", (folder_id,))
        conn.execute("DELETE FROM folders WHERE id = ?", (folder_id,))


# ── 2. Documents ───────────────────────────────────────────────────────────────

def insert_document(
    filename: str,
    filepath: str,
    file_size: int,
    token_count: int,
    uploaded_at: str,
    folder_id: Optional[int] = None,
) -> int:
    """Insert a new document row and return the new primary key."""
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO documents (filename, filepath, file_size, token_count, uploaded_at, folder_id)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (filename, filepath, file_size, token_count, uploaded_at, folder_id),
        )
        return cursor.lastrowid  # type: ignore[return-value]


def update_document_filepath(doc_id: int, filepath: str) -> None:
    """Update the filepath column after the physical file has been saved."""
    with get_db() as conn:
        conn.execute(
            "UPDATE documents SET filepath = ? WHERE id = ?",
            (filepath, doc_id),
        )


def update_document_filename(doc_id: int, filename: str) -> None:
    """Update the filename column for an existing document."""
    with get_db() as conn:
        conn.execute(
            "UPDATE documents SET filename = ? WHERE id = ?",
            (filename, doc_id),
        )


def update_document_folder(doc_id: int, folder_id: Optional[int]) -> None:
    """Update the folder_id column for an existing document."""
    with get_db() as conn:
        conn.execute(
            "UPDATE documents SET folder_id = ? WHERE id = ?",
            (folder_id, doc_id),
        )


def get_all_documents(folder_id: Optional[int] = None) -> List[dict]:
    """Return documents ordered by upload date (newest first), optionally filtered by folder_id."""
    with get_db() as conn:
        if folder_id is not None:
            rows = conn.execute(
                """SELECT d.*, f.name AS folder_name
                   FROM documents d
                   LEFT JOIN folders f ON d.folder_id = f.id
                   WHERE d.folder_id = ?
                   ORDER BY d.uploaded_at DESC""",
                (folder_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT d.*, f.name AS folder_name
                   FROM documents d
                   LEFT JOIN folders f ON d.folder_id = f.id
                   ORDER BY d.uploaded_at DESC"""
            ).fetchall()
        return [dict(row) for row in rows]


def get_document_by_id(doc_id: int) -> Optional[dict]:
    """Return a single document dict, or None if not found."""
    with get_db() as conn:
        row = conn.execute(
            """SELECT d.*, f.name AS folder_name
               FROM documents d
               LEFT JOIN folders f ON d.folder_id = f.id
               WHERE d.id = ?""",
            (doc_id,),
        ).fetchone()
        return dict(row) if row else None


def get_document_ids_for_folder(folder_id: int) -> List[int]:
    """Return list of document IDs belonging to a specific folder."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id FROM documents WHERE folder_id = ?",
            (folder_id,),
        ).fetchall()
        return [row[0] for row in rows]


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


# ── 4. Settings ────────────────────────────────────────────────────────────────

def get_settings() -> dict:
    """Return the single settings row as a dict."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM settings WHERE id = 1").fetchone()
        if not row:
            conn.execute(
                """INSERT OR IGNORE INTO settings
                   (id, case_sensitive, stop_words_enabled, default_search_mode, max_file_size_mb, rebuild_required, indexed_case_sensitive, indexed_stop_words)
                   VALUES (1, 0, 1, 'any', 5, 0, 0, 1)"""
            )
            row = conn.execute("SELECT * FROM settings WHERE id = 1").fetchone()
        return dict(row)


def update_settings(fields: dict) -> dict:
    """Update settings fields and recalculate rebuild_required."""
    current = get_settings()

    new_case_sensitive = fields.get("case_sensitive", bool(current["case_sensitive"]))
    new_stop_words = fields.get("stop_words_enabled", bool(current["stop_words_enabled"]))
    new_search_mode = fields.get("default_search_mode", current["default_search_mode"])
    new_max_size = fields.get("max_file_size_mb", current["max_file_size_mb"])

    rebuild_required = int(
        bool(new_case_sensitive) != bool(current["indexed_case_sensitive"])
        or bool(new_stop_words) != bool(current["indexed_stop_words"])
    )

    with get_db() as conn:
        conn.execute(
            """UPDATE settings
               SET case_sensitive      = ?,
                   stop_words_enabled  = ?,
                   default_search_mode = ?,
                   max_file_size_mb    = ?,
                   rebuild_required    = ?
               WHERE id = 1""",
            (
                1 if new_case_sensitive else 0,
                1 if new_stop_words else 0,
                new_search_mode,
                new_max_size,
                rebuild_required,
            ),
        )
    return get_settings()


def mark_rebuild_complete(case_sensitive: bool, stop_words_enabled: bool) -> None:
    """Mark rebuild as complete and synchronize indexed preprocessing settings."""
    with get_db() as conn:
        conn.execute(
            """UPDATE settings
               SET rebuild_required       = 0,
                   indexed_case_sensitive = ?,
                   indexed_stop_words     = ?
               WHERE id = 1""",
            (1 if case_sensitive else 0, 1 if stop_words_enabled else 0),
        )

