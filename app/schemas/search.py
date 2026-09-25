from pydantic import BaseModel, Field
from typing import List


class SearchRequest(BaseModel):
    """Incoming search request body."""
    query: str = Field(..., min_length=1, description="Search query string")
    top_k: int = Field(default=10, ge=1, le=100, description="Maximum number of results to return")


class SearchResultItem(BaseModel):
    """A single ranked search result."""
    doc_id: int
    filename: str
    score: float
    snippet: str
    matched_terms: List[str]


class SearchResponse(BaseModel):
    """Full search response with ranked results."""
    query: str
    total_results: int
    results: List[SearchResultItem]
