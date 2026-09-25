from pydantic import BaseModel
from typing import Optional


class IndexStats(BaseModel):
    """Current state of the inverted index."""
    total_documents: int
    total_unique_terms: int
    last_built_at: Optional[str]
    index_status: str


class RebuildResponse(BaseModel):
    """Response after a successful index rebuild."""
    message: str
    total_documents: int
    total_unique_terms: int
    rebuilt_at: str
