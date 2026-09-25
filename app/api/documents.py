"""
api/documents.py
----------------
Document management endpoints:
    GET    /documents          — list all uploaded documents
    POST   /documents          — upload a new .txt document
    DELETE /documents/{doc_id} — delete a document and its index entries
"""

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.document import DocumentListOut, DocumentOut
from app.services import document_service

router = APIRouter(prefix="/documents", tags=["Documents"])

# Maximum allowed file size: 5 MB
MAX_FILE_SIZE = 5 * 1024 * 1024


@router.get("", response_model=DocumentListOut, summary="List all documents")
def list_documents():
    """Return metadata for every document currently in the corpus."""
    docs = document_service.list_documents()
    return {"total": len(docs), "documents": docs}


@router.post("", response_model=DocumentOut, status_code=201, summary="Upload a document")
async def upload_document(file: UploadFile = File(...)):
    """
    Accept a `.txt` file, preprocess it, and add it to the search index.

    - Only `.txt` files are accepted.
    - Files larger than 5 MB are rejected.
    - Duplicate filenames are allowed (each upload gets its own ID).
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

    doc = document_service.upload_document(file.filename, content)
    return doc


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
