"""
api/folders.py
--------------
Folder management endpoints:
    GET    /folders             — list all folders with document counts
    POST   /folders             — create a new folder
    GET    /folders/{folder_id} — get folder metadata and document count
    PATCH  /folders/{folder_id} — rename a folder
    DELETE /folders/{folder_id} — delete a folder (moves documents to root)
"""

from fastapi import APIRouter, HTTPException

from app.schemas.folder import FolderCreate, FolderListOut, FolderOut, FolderUpdate
from app.services import folder_service

router = APIRouter(prefix="/folders", tags=["Folders"])


@router.get("", response_model=FolderListOut, summary="List all folders")
def list_folders():
    """Return all folders ordered alphabetically with document counts."""
    folders = folder_service.list_folders()
    return {"total": len(folders), "folders": folders}


@router.post("", response_model=FolderOut, status_code=201, summary="Create a folder")
def create_folder(payload: FolderCreate):
    """Create a new folder with a unique name."""
    try:
        folder = folder_service.create_folder(payload.name)
        return folder
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{folder_id}", response_model=FolderOut, summary="Get folder by ID")
def get_folder(folder_id: int):
    """Return folder metadata and document count."""
    folder = folder_service.get_folder(folder_id)
    if not folder:
        raise HTTPException(
            status_code=404,
            detail=f"Folder with id={folder_id} was not found.",
        )
    return folder


@router.patch("/{folder_id}", response_model=FolderOut, summary="Rename a folder")
def rename_folder(folder_id: int, payload: FolderUpdate):
    """Rename an existing folder."""
    try:
        folder = folder_service.rename_folder(folder_id, payload.name)
        if not folder:
            raise HTTPException(
                status_code=404,
                detail=f"Folder with id={folder_id} was not found.",
            )
        return folder
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{folder_id}", status_code=204, summary="Delete a folder")
def delete_folder(folder_id: int):
    """
    Delete a folder.
    Documents in this folder are preserved and moved to root (folder_id = None).
    """
    success = folder_service.delete_folder(folder_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Folder with id={folder_id} was not found.",
        )
