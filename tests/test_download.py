"""
tests/test_download.py
----------------------
Validates document downloading for both TXT and PDF export formats:
1. Existing document downloads as TXT.
2. Downloaded TXT content exactly matches stored content.
3. Correct filename is returned.
4. Missing document returns 404.
5. Existing document downloads as PDF.
6. Response has the correct PDF content type.
7. PDF contains the document text.
8. Correct PDF filename is returned.
9. Long text produces a valid multi-page PDF.
10. Missing document returns 404 (PDF format).
11. Invalid format returns 400.
12. Missing physical file is handled correctly (500).
"""

import base64
import os
import re
import zlib
from tests.conftest import upload_txt
from app.db import crud


def _extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Helper to extract decompressed stream text from ReportLab PDF."""
    texts = []
    pattern = re.compile(rb"stream[\r\n]+(.*?)[\r\n]*endstream", re.DOTALL)
    for m in pattern.finditer(pdf_bytes):
        chunk = m.group(1).strip()
        # ReportLab streams are usually Ascii85 + Flate encoded
        try:
            raw = base64.a85decode(chunk, adobe=True)
            decompressed = zlib.decompress(raw)
            texts.append(decompressed.decode("latin1", errors="ignore"))
        except Exception:
            try:
                decompressed = zlib.decompress(chunk)
                texts.append(decompressed.decode("latin1", errors="ignore"))
            except Exception:
                texts.append(chunk.decode("latin1", errors="ignore"))
    return " ".join(texts)


def _count_pdf_pages(pdf_bytes: bytes) -> int:
    """Helper to count page dictionary objects in PDF."""
    return len(re.findall(rb"/Type\s*/Page\b", pdf_bytes))


# ── TXT tests ──────────────────────────────────────────────────────────────────

def test_download_txt_existing(client):
    """1. Existing document downloads as TXT with 200 OK."""
    content = "Linear data structures include arrays and linked lists."
    r = upload_txt(client, "Arrays Basics.txt", content)
    assert r.status_code == 201
    doc_id = r.json()["id"]

    res = client.get(f"/documents/{doc_id}/download?format=txt")
    assert res.status_code == 200
    assert "text/plain" in res.headers["content-type"]


def test_download_txt_content_match(client):
    """2. Downloaded TXT content exactly matches stored content."""
    original_text = "Line 1: UTF-8 characters: café, résumé, 1 < 2 & 3 > 0.\nLine 2: Exact match test."
    r = upload_txt(client, "test_match.txt", original_text)
    assert r.status_code == 201
    doc_id = r.json()["id"]

    res = client.get(f"/documents/{doc_id}/download?format=txt")
    assert res.status_code == 200
    assert res.text == original_text
    assert res.content == original_text.encode("utf-8")


def test_download_txt_filename_returned(client):
    """3. Correct filename is returned in Content-Disposition header."""
    filename = "Arrays Basics.txt"
    r = upload_txt(client, filename, "Sample text.")
    doc_id = r.json()["id"]

    res = client.get(f"/documents/{doc_id}/download?format=txt")
    assert res.status_code == 200
    cd = res.headers.get("content-disposition", "")
    assert "attachment" in cd
    assert "Arrays Basics.txt" in cd


def test_download_txt_missing_document(client):
    """4. Missing document returns 404."""
    res = client.get("/documents/99999/download?format=txt")
    assert res.status_code == 404
    assert "99999" in res.json()["detail"]


# ── PDF tests ──────────────────────────────────────────────────────────────────

def test_download_pdf_existing(client):
    """5. Existing document downloads as PDF with 200 OK."""
    r = upload_txt(client, "doc_pdf.txt", "Some content for PDF export.")
    doc_id = r.json()["id"]

    res = client.get(f"/documents/{doc_id}/download?format=pdf")
    assert res.status_code == 200
    assert res.content.startswith(b"%PDF-")


def test_download_pdf_content_type(client):
    """6. Response has the correct PDF content type (application/pdf)."""
    r = upload_txt(client, "doc_type.txt", "Testing content-type.")
    doc_id = r.json()["id"]

    res = client.get(f"/documents/{doc_id}/download?format=pdf")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"


def test_download_pdf_contains_text(client):
    """7. PDF contains the document text."""
    unique_phrase = "UniqueSearchableVocabularyPhrase456"
    r = upload_txt(client, "doc_text.txt", f"Introduction.\n\n{unique_phrase}\n\nConclusion.")
    doc_id = r.json()["id"]

    res = client.get(f"/documents/{doc_id}/download?format=pdf")
    assert res.status_code == 200
    extracted_text = _extract_text_from_pdf(res.content)
    assert unique_phrase in extracted_text


def test_download_pdf_filename_returned(client):
    """8. Correct PDF filename is returned with .pdf extension based on current document name."""
    r = upload_txt(client, "Arrays Basics.txt", "Testing PDF filename.")
    doc_id = r.json()["id"]

    res = client.get(f"/documents/{doc_id}/download?format=pdf")
    assert res.status_code == 200
    cd = res.headers.get("content-disposition", "")
    assert "attachment" in cd
    assert "Arrays Basics.pdf" in cd


def test_download_pdf_long_text_multipage(client):
    """9. Long text produces a valid multi-page PDF."""
    long_content = "\n\n".join(
        f"Paragraph {i}: " + ("This is detailed text explaining algorithms and data structures. " * 15)
        for i in range(1, 35)
    )
    r = upload_txt(client, "LongDocument.txt", long_content)
    doc_id = r.json()["id"]

    res = client.get(f"/documents/{doc_id}/download?format=pdf")
    assert res.status_code == 200
    assert res.content.startswith(b"%PDF-")
    pages = _count_pdf_pages(res.content)
    assert pages >= 2, f"Expected at least 2 pages, got {pages}"


def test_download_pdf_missing_document(client):
    """10. Missing document returns 404 for PDF format."""
    res = client.get("/documents/88888/download?format=pdf")
    assert res.status_code == 404
    assert "88888" in res.json()["detail"]


# ── Validation & Error tests ───────────────────────────────────────────────────

def test_download_invalid_format(client):
    """11. Invalid format returns 400 Bad Request."""
    r = upload_txt(client, "sample.txt", "Valid document.")
    doc_id = r.json()["id"]

    for bad_fmt in ["docx", "html", "json", "exe", ""]:
        res = client.get(f"/documents/{doc_id}/download?format={bad_fmt}")
        assert res.status_code == 400
        assert "Invalid format" in res.json()["detail"]


def test_download_missing_physical_file(client):
    """12. Missing physical file is handled correctly with 500 error."""
    r = upload_txt(client, "will_delete_file.txt", "Content before deletion.")
    doc_id = r.json()["id"]

    # Get filepath and remove the file from disk while leaving DB row intact
    doc = crud.get_document_by_id(doc_id)
    assert os.path.exists(doc["filepath"])
    os.remove(doc["filepath"])

    # Attempting to download TXT
    res_txt = client.get(f"/documents/{doc_id}/download?format=txt")
    assert res_txt.status_code == 500
    assert "missing from disk" in res_txt.json()["detail"]

    # Attempting to download PDF
    res_pdf = client.get(f"/documents/{doc_id}/download?format=pdf")
    assert res_pdf.status_code == 500
    assert "missing from disk" in res_pdf.json()["detail"]


# ── Rename, Move, Copy Compatibility tests ─────────────────────────────────────

def test_download_renamed_document(client):
    """Renamed document exports with updated name for both TXT and PDF."""
    r = upload_txt(client, "Arrays.txt", "Content inside Arrays doc.")
    doc_id = r.json()["id"]

    # Rename
    patch_r = client.patch(f"/documents/{doc_id}", json={"filename": "Arrays Basics.txt"})
    assert patch_r.status_code == 200

    # TXT download should have new name
    res_txt = client.get(f"/documents/{doc_id}/download?format=txt")
    assert res_txt.status_code == 200
    assert "Arrays Basics.txt" in res_txt.headers["content-disposition"]

    # PDF download should have new name
    res_pdf = client.get(f"/documents/{doc_id}/download?format=pdf")
    assert res_pdf.status_code == 200
    assert "Arrays Basics.pdf" in res_pdf.headers["content-disposition"]


def test_download_moved_and_copied_document(client):
    """Moved and copied documents download correctly in both formats."""
    # Create folders DSA and PCQ
    f_dsa = client.post("/folders", json={"name": "DSA"}).json()
    f_pcq = client.post("/folders", json={"name": "PCQ"}).json()

    # Upload
    r = upload_txt(client, "Arrays Basics.txt", "Array data structure fundamentals.")
    doc_id = r.json()["id"]

    # Move to DSA
    client.patch(f"/documents/{doc_id}", json={"folder_id": f_dsa["id"]})

    # Download from folder
    res_txt = client.get(f"/documents/{doc_id}/download?format=txt")
    assert res_txt.status_code == 200
    assert res_txt.text == "Array data structure fundamentals."

    res_pdf = client.get(f"/documents/{doc_id}/download?format=pdf")
    assert res_pdf.status_code == 200
    assert res_pdf.content.startswith(b"%PDF-")

    # Copy to PCQ
    copy_r = client.post(f"/documents/{doc_id}/copy", json={"folder_id": f_pcq["id"]})
    assert copy_r.status_code == 201
    copy_id = copy_r.json()["id"]
    assert copy_id != doc_id

    # Download copied document in both formats
    res_copy_txt = client.get(f"/documents/{copy_id}/download?format=txt")
    assert res_copy_txt.status_code == 200
    assert res_copy_txt.text == "Array data structure fundamentals."

    res_copy_pdf = client.get(f"/documents/{copy_id}/download?format=pdf")
    assert res_copy_pdf.status_code == 200
    assert res_copy_pdf.content.startswith(b"%PDF-")

    # Delete original document
    del_r = client.delete(f"/documents/{doc_id}")
    assert del_r.status_code == 204

    # Verify original is gone
    assert client.get(f"/documents/{doc_id}/download?format=txt").status_code == 404

    # Verify copy can still be downloaded in both formats
    assert client.get(f"/documents/{copy_id}/download?format=txt").status_code == 200
    assert client.get(f"/documents/{copy_id}/download?format=pdf").status_code == 200
