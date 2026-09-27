"""
services/pdf_service.py
-----------------------
Generates clean, readable, standard PDF exports from stored document text using ReportLab.

Specifications:
- Clean white page (Letter size, 54pt / 0.75in margins).
- Readable standard typography (Helvetica / Helvetica-Bold).
- Title at the top derived from document filename.
- Subtle horizontal divider rule.
- Preserves paragraphs and line breaks.
- Automatic line wrapping and page breaks.
- Centered footer with page numbers ("Page 1", "Page 2", ...).
- No decorative graphics, gradients, or futuristic styling.
"""

import html
import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate


def get_pdf_filename(filename: str) -> str:
    """Return the filename ending with .pdf, replacing .txt if present."""
    if filename.lower().endswith(".txt"):
        return filename[:-4] + ".pdf"
    return f"{filename}.pdf"


def generate_document_pdf(filename: str, content: str) -> bytes:
    """
    Generate a clean, standard, readable PDF document in memory.
    Returns raw PDF bytes. Does not save to disk.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        textColor=colors.HexColor("#111827"),
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "DocBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#1F2937"),
        spaceAfter=8,
    )

    display_title = filename[:-4] if filename.lower().endswith(".txt") else filename

    story = [
        Paragraph(html.escape(display_title), title_style),
        HRFlowable(
            width="100%",
            thickness=0.75,
            color=colors.HexColor("#D1D5DB"),
            spaceBefore=4,
            spaceAfter=14,
        ),
    ]

    # Split by double newline to preserve paragraph structure.
    # Within each paragraph, convert single newlines to <br/>.
    paragraphs = content.split("\n\n")
    has_content = False
    for para in paragraphs:
        cleaned = para.strip()
        if not cleaned:
            continue
        has_content = True
        escaped = html.escape(cleaned).replace("\n", "<br/>").replace("\t", "&nbsp;&nbsp;&nbsp;&nbsp;")
        story.append(Paragraph(escaped, body_style))

    if not has_content:
        story.append(Paragraph("<i>(Empty document)</i>", body_style))

    def _add_footer(canvas, doc_template):
        canvas.saveState()
        canvas.setFont("Helvetica", 9)
        canvas.setFillColor(colors.HexColor("#6B7280"))
        page_str = f"Page {canvas.getPageNumber()}"
        canvas.drawCentredString(doc_template.pagesize[0] / 2.0, 32, page_str)
        canvas.restoreState()

    doc.build(story, onFirstPage=_add_footer, onLaterPages=_add_footer)
    return buf.getvalue()
