from pydantic import BaseModel
from typing import List


class DocumentOut(BaseModel):
    """Represents a document returned by the API."""
    id: int
    filename: str
    file_size: int
    token_count: int
    uploaded_at: str


class DocumentListOut(BaseModel):
    """Paginated list of documents."""
    total: int
    documents: List[DocumentOut]
