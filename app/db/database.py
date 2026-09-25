"""
db/database.py
--------------
SQLite connection factory and schema bootstrap.

Design decisions:
- Uses Python's built-in `sqlite3` — no ORM required.
- `row_factory = sqlite3.Row` lets us access columns by name (row["id"]).
- `PRAGMA foreign_keys = ON` enables cascade deletes on the postings table.
- `get_db()` is a context manager that commits on success and rolls back on error.
- `init_db()` is called once at application startup from main.py.
"""

import os
import sqlite3
from contextlib import contextmanager

# Reads from environment (loaded by dotenv in main.py before this module is imported).
DB_PATH: str = os.getenv("DATABASE_URL", "./database.db")

_CREATE_SCHEMA = """
    CREATE TABLE IF NOT EXISTS documents (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        filename    TEXT    NOT NULL,
        filepath    TEXT    NOT NULL,
        file_size   INTEGER NOT NULL,
        token_count INTEGER NOT NULL,
        uploaded_at TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS postings (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        term           TEXT    NOT NULL,
        doc_id         INTEGER NOT NULL,
        term_frequency INTEGER NOT NULL,
        positions      TEXT    NOT NULL,
        FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    -- Speed up term lookups (the hot path during search).
    CREATE INDEX IF NOT EXISTS idx_term   ON postings(term);
    CREATE INDEX IF NOT EXISTS idx_doc_id ON postings(doc_id);

    CREATE TABLE IF NOT EXISTS index_meta (
        id                 INTEGER PRIMARY KEY CHECK (id = 1),
        total_documents    INTEGER NOT NULL DEFAULT 0,
        total_unique_terms INTEGER NOT NULL DEFAULT 0,
        last_built_at      TEXT,
        index_status       TEXT    NOT NULL DEFAULT 'empty'
    );

    -- Seed the single-row meta table on first run.
    INSERT OR IGNORE INTO index_meta (id, total_documents, total_unique_terms, index_status)
    VALUES (1, 0, 0, 'empty');
"""


@contextmanager
def get_db():
    """
    Yield a SQLite connection, commit on success, rollback on error.

    Usage:
        with get_db() as conn:
            conn.execute(...)
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Create all tables and indexes if they do not already exist."""
    with get_db() as conn:
        conn.executescript(_CREATE_SCHEMA)
