"""
api/settings.py
---------------
Engine Configuration endpoints:
    GET   /settings — get current engine configuration settings
    PATCH /settings — update engine configuration settings
"""

from fastapi import APIRouter, HTTPException

from app.db import crud
from app.schemas.settings import SettingsOut, SettingsUpdate

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=SettingsOut, summary="Get engine settings")
def get_settings():
    """Return the active engine settings, including index rebuild status."""
    s = crud.get_settings()
    return {
        "case_sensitive": bool(s["case_sensitive"]),
        "stop_words_enabled": bool(s["stop_words_enabled"]),
        "default_search_mode": s["default_search_mode"],
        "max_file_size_mb": s["max_file_size_mb"],
        "ranking_algorithm": "TF-IDF",
        "accepted_file_types": [".txt"],
        "rebuild_required": bool(s["rebuild_required"]),
    }


@router.patch("", response_model=SettingsOut, summary="Update engine settings")
def update_settings(payload: SettingsUpdate):
    """
    Update one or more engine settings.

    - Case sensitivity and stopword filtering affect preprocessing and flag
      that an index rebuild is required until /index/rebuild is run.
    - Default search mode and max file size do not affect index postings.
    """
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided to update.")

    if "default_search_mode" in update_data and hasattr(update_data["default_search_mode"], "value"):
        update_data["default_search_mode"] = update_data["default_search_mode"].value

    updated = crud.update_settings(update_data)
    return {
        "case_sensitive": bool(updated["case_sensitive"]),
        "stop_words_enabled": bool(updated["stop_words_enabled"]),
        "default_search_mode": updated["default_search_mode"],
        "max_file_size_mb": updated["max_file_size_mb"],
        "ranking_algorithm": "TF-IDF",
        "accepted_file_types": [".txt"],
        "rebuild_required": bool(updated["rebuild_required"]),
    }
