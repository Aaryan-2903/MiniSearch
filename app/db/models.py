"""
db/models.py
------------
Python dataclasses mirroring each SQLite table.
Used as typed return types from crud functions.
No ORM — keeps the DB layer simple and dependency-free.
"""

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class Folder:
    id: int
    name: str
    created_at: str
    document_count: int = 0


@dataclass
class Document:
    id: int
    filename: str
    filepath: str
    file_size: int
    token_count: int
    uploaded_at: str
    folder_id: Optional[int] = None
    folder_name: Optional[str] = None


@dataclass
class Posting:
    id: int
    term: str
    doc_id: int
    term_frequency: int
    positions: str  # JSON-encoded list of char offsets


@dataclass
class IndexMeta:
    id: int
    total_documents: int
    total_unique_terms: int
    last_built_at: Optional[str]
    index_status: str  # "empty" | "building" | "ready"


@dataclass
class Settings:
    id: int
    case_sensitive: bool
    stop_words_enabled: bool
    default_search_mode: str
    max_file_size_mb: int
    rebuild_required: bool
    indexed_case_sensitive: bool
    indexed_stop_words: bool
