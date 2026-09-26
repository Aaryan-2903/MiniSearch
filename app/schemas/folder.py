from pydantic import BaseModel, Field
from typing import List


class FolderCreate(BaseModel):
    """Schema for creating a new folder."""
    name: str = Field(..., min_length=1, max_length=100, description="Folder name (must be unique)")


class FolderUpdate(BaseModel):
    """Schema for renaming an existing folder."""
    name: str = Field(..., min_length=1, max_length=100, description="New folder name")


class FolderOut(BaseModel):
    """Folder metadata with document count."""
    id: int
    name: str
    created_at: str
    document_count: int = 0


class FolderListOut(BaseModel):
    """List of all folders."""
    total: int
    folders: List[FolderOut]
