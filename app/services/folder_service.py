"""
services/folder_service.py
--------------------------
Orchestrates manual folder creation, listing, renaming, and deletion.
"""

from datetime import datetime, timezone
from typing import Optional, List
from app.db import crud


def list_folders() -> List[dict]:
    """Return all folders ordered alphabetically."""
    return crud.get_all_folders()


def get_folder(folder_id: int) -> Optional[dict]:
    """Retrieve folder by primary key with document count."""
    return crud.get_folder_by_id(folder_id)


def create_folder(name: str) -> dict:
    """
    Create a new folder.
    Raises ValueError if name is empty or already taken.
    """
    clean_name = name.strip()
    if not clean_name:
        raise ValueError("Folder name cannot be empty.")

    existing = crud.get_folder_by_name(clean_name)
    if existing:
        raise ValueError(f"Folder with name '{clean_name}' already exists.")

    created_at = datetime.now(timezone.utc).isoformat()
    folder_id = crud.insert_folder(clean_name, created_at)
    return crud.get_folder_by_id(folder_id)  # type: ignore[return-value]


def rename_folder(folder_id: int, new_name: str) -> Optional[dict]:
    """
    Rename an existing folder.
    Raises ValueError if name is empty or already taken by another folder.
    Returns None if folder does not exist.
    """
    folder = crud.get_folder_by_id(folder_id)
    if not folder:
        return None

    clean_name = new_name.strip()
    if not clean_name:
        raise ValueError("Folder name cannot be empty.")

    existing = crud.get_folder_by_name(clean_name)
    if existing and existing["id"] != folder_id:
        raise ValueError(f"Folder with name '{clean_name}' already exists.")

    crud.update_folder_name(folder_id, clean_name)
    return crud.get_folder_by_id(folder_id)


def delete_folder(folder_id: int) -> bool:
    """
    Delete a folder.
    Moves all documents in this folder to root (folder_id = None).
    Returns False if folder does not exist.
    """
    folder = crud.get_folder_by_id(folder_id)
    if not folder:
        return False

    crud.delete_folder(folder_id)
    return True
