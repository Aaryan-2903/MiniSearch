from pydantic import BaseModel, Field
from typing import List, Optional


class DocumentOut(BaseModel):
    """Represents a document returned by the API."""
    id: int
    filename: str
    file_size: int
    token_count: int
    uploaded_at: str
    folder_id: Optional[int] = None
    folder_name: Optional[str] = None


class DocumentListOut(BaseModel):
    """Paginated list of documents."""
    total: int
    documents: List[DocumentOut]


class DocumentDetailOut(DocumentOut):
    """Represents a document returned by the API with its text content."""
    content: str


class DocumentUpdate(BaseModel):
    """Payload for updating (renaming or moving) a document."""
    filename: Optional[str] = Field(default=None, description="New filename (must end in .txt)")
    folder_id: Optional[int] = Field(default=None, description="Target folder ID, or null to move to root")


class DocumentCopyRequest(BaseModel):
    """Payload for copying a document to a folder."""
    folder_id: Optional[int] = Field(default=None, description="Target folder ID, or null for root")

