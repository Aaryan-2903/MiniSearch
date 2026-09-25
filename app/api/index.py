"""
api/index.py
------------
Index management endpoints:
    GET  /index/stats   — return current index statistics
    POST /index/rebuild — rebuild the entire inverted index from scratch
"""

from fastapi import APIRouter

from app.schemas.index import IndexStats, RebuildResponse
from app.services import index_service

router = APIRouter(prefix="/index", tags=["Index"])


@router.get("/stats", response_model=IndexStats, summary="Get index statistics")
def get_index_stats():
    """
    Return metadata about the current state of the inverted index:
    - Total documents indexed
    - Total unique terms
    - Timestamp of the last build
    - Index status (empty | ready | building)
    """
    return index_service.get_stats()


@router.post("/rebuild", response_model=RebuildResponse, summary="Rebuild the index")
def rebuild_index():
    """
    Drop all postings and reprocess every document from scratch.

    Use this endpoint when:
    - The index is suspected to be corrupt or inconsistent.
    - Preprocessing rules have changed (e.g., stop-word list updated).
    - Documents were modified outside the API.

    This is a synchronous operation — the response is returned only after
    the rebuild is complete.
    """
    return index_service.rebuild()
