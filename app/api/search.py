"""
api/search.py
-------------
POST /search — full-text search with TF-IDF ranked results.
"""

from fastapi import APIRouter, HTTPException

from app.schemas.search import SearchRequest, SearchResponse
from app.services import search_service

router = APIRouter(prefix="/search", tags=["Search"])


@router.post("", response_model=SearchResponse, summary="Search documents")
def search(request: SearchRequest):
    """
    Search the indexed corpus using TF-IDF ranking.

    - Query terms are preprocessed using the same pipeline as indexing.
    - Results use OR semantics: documents matching any query term are returned,
      ranked by their combined TF-IDF score.
    - Each result includes a text snippet centred on the first matched term.
    - `top_k` controls the maximum number of results returned (1–100).
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    match_mode = None
    if request.match_mode is not None:
        match_mode = request.match_mode.value if hasattr(request.match_mode, "value") else str(request.match_mode)

    return search_service.search(
        request.query,
        request.top_k,
        match_mode=match_mode,
        folder_id=request.folder_id,
    )
