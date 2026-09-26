from enum import Enum
from pydantic import BaseModel, Field
from typing import List, Optional


class MatchMode(str, Enum):
    ANY = "any"
    ALL = "all"


class SearchRequest(BaseModel):
    """Incoming search request body."""
    query: str = Field(..., min_length=1, description="Search query string")
    top_k: int = Field(default=10, ge=1, le=100, description="Maximum number of results to return")
    match_mode: MatchMode = Field(default=MatchMode.ANY, description="Search match mode: 'any' (OR) or 'all' (AND)")
    folder_id: Optional[int] = Field(default=None, description="Optional folder ID to scope search")


class TermExplanation(BaseModel):
    """TF-IDF components for a single matched term."""
    term: str
    tf: int
    df: int
    idf: float
    tfidf: float


class Explanation(BaseModel):
    """Detailed explanation of the TF-IDF ranking calculation."""
    total_documents: int
    query_terms_count: int
    matched_terms_count: int
    term_details: List[TermExplanation]


class SearchResultItem(BaseModel):
    """A single ranked search result."""
    doc_id: int
    filename: str
    score: float
    snippet: str
    matched_terms: List[str]
    folder_id: Optional[int] = None
    folder_name: Optional[str] = None
    explanation: Optional[Explanation] = None


class SearchResponse(BaseModel):
    """Full search response with ranked results and metadata."""
    query: str
    total_results: int
    execution_time_ms: float = 0.0
    query_terms_count: int = 0
    ranking_method: str = "TF-IDF"
    match_mode: str = "any"
    folder_id: Optional[int] = None
    results: List[SearchResultItem]


