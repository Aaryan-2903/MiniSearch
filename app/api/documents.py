"""
api/documents.py
----------------
Document management endpoints:
    GET    /documents          — list all uploaded documents
    POST   /documents          — upload a new .txt document
    DELETE /documents/{doc_id} — delete a document and its index entries
"""

from typing import Optional
from urllib.parse import quote
from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile

from app.schemas.document import (
    DocumentCopyRequest,
    DocumentDetailOut,
    DocumentListOut,
    DocumentOut,
    DocumentUpdate,
)
from app.services import document_service, pdf_service

router = APIRouter(prefix="/documents", tags=["Documents"])

# Maximum allowed file size: 5 MB
MAX_FILE_SIZE = 5 * 1024 * 1024


@router.get("", response_model=DocumentListOut, summary="List all documents")
def list_documents(folder_id: Optional[int] = None):
    """Return metadata for documents currently in the corpus, optionally filtered by folder_id."""
    docs = document_service.list_documents(folder_id=folder_id)
    return {"total": len(docs), "documents": docs}


@router.get("/{doc_id}", response_model=DocumentDetailOut, summary="Get document by ID")
def get_document(doc_id: int):
    """Return document metadata and its text content."""
    try:
        doc = document_service.get_document(doc_id)
        if not doc:
            raise HTTPException(
                status_code=404,
                detail=f"Document with id={doc_id} was not found.",
            )
        return doc
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=500,
            detail="Document record exists, but the file is missing from disk.",
        )


@router.get("/{doc_id}/download", summary="Download document as TXT or PDF")
def download_document(doc_id: int, format: str = "txt"):
    """
    Download an existing document as either original plain text (.txt) or formatted PDF (.pdf).
    """
    fmt = format.strip().lower()
    if fmt not in ("txt", "pdf"):
        raise HTTPException(
            status_code=400,
            detail="Invalid format. Supported formats are 'txt' and 'pdf'.",
        )

    try:
        doc = document_service.get_document(doc_id)
        if not doc:
            raise HTTPException(
                status_code=404,
                detail=f"Document with id={doc_id} was not found.",
            )
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Document record exists, but the file is missing from disk.",
        )

    if fmt == "txt":
        filename = doc["filename"]
        ascii_filename = filename.replace('"', '\\"')
        encoded_filename = quote(filename)
        return Response(
            content=doc["content"].encode("utf-8"),
            media_type="text/plain; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{ascii_filename}"; filename*=utf-8\'\'{encoded_filename}'
            },
        )
    else:  # pdf
        pdf_filename = pdf_service.get_pdf_filename(doc["filename"])
        pdf_bytes = pdf_service.generate_document_pdf(doc["filename"], doc["content"])
        ascii_filename = pdf_filename.replace('"', '\\"')
        encoded_filename = quote(pdf_filename)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{ascii_filename}"; filename*=utf-8\'\'{encoded_filename}'
            },
        )


@router.post("", response_model=DocumentOut, status_code=201, summary="Upload a document")
async def upload_document(
    file: UploadFile = File(...),
    folder_id: Optional[int] = Form(None),
):
    """
    Accept a `.txt` file, preprocess it, and add it to the search index.

    - Only `.txt` files are accepted.
    - Files larger than 5 MB are rejected.
    - Duplicate filenames are allowed (each upload gets its own ID).
    - Can optionally specify folder_id to store in a folder.
    """
    if not file.filename or not file.filename.lower().endswith(".txt"):
        raise HTTPException(
            status_code=400,
            detail="Only plain-text (.txt) files are supported.",
        )

    content = await file.read()

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the maximum allowed size of {MAX_FILE_SIZE // (1024*1024)} MB.",
        )

    try:
        doc = document_service.upload_document(file.filename, content, folder_id=folder_id)
        return doc
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/{doc_id}", response_model=DocumentOut, summary="Update document (rename or move)")
def update_document(doc_id: int, payload: DocumentUpdate):
    """
    Rename a document or move it to a folder (or root).
    """
    try:
        update_dict = payload.model_dump(exclude_unset=True)
        if not update_dict:
            raise HTTPException(status_code=400, detail="No fields provided to update.")

        doc = None
        if "filename" in update_dict:
            doc = document_service.rename_document(doc_id, update_dict["filename"])
            if not doc:
                raise HTTPException(status_code=404, detail=f"Document with id={doc_id} was not found.")

        if "folder_id" in update_dict:
            doc = document_service.move_document(doc_id, update_dict["folder_id"])
            if not doc:
                raise HTTPException(status_code=404, detail=f"Document with id={doc_id} was not found.")

        return doc
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{doc_id}/copy", response_model=DocumentOut, status_code=201, summary="Copy a document")
def copy_document(doc_id: int, payload: Optional[DocumentCopyRequest] = None):
    """
    Copy a document into a folder (or root).
    Creates a new document record, duplicates file contents, and indexes the copy.
    """
    target_folder_id = payload.folder_id if payload else None
    try:
        doc = document_service.copy_document(doc_id, target_folder_id=target_folder_id)
        if not doc:
            raise HTTPException(status_code=404, detail=f"Document with id={doc_id} was not found.")
        return doc
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{doc_id}", status_code=204, summary="Delete a document")
def delete_document(doc_id: int):
    """
    Remove a document from the corpus and its entries from the inverted index.
    Returns 204 No Content on success, 404 if the document does not exist.
    """
    success = document_service.delete_document(doc_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Document with id={doc_id} was not found.",
        )

