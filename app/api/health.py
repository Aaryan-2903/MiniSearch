"""
api/health.py
-------------
GET /health — simple liveness check.
"""

from datetime import datetime, timezone
from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health", summary="Liveness check")
def health_check():
    """Returns HTTP 200 with service name and current UTC timestamp."""
    return {
        "status": "ok",
        "service": "MiniSearch",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
