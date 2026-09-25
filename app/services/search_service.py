"""
services/search_service.py
---------------------------
Orchestrates a full search request end-to-end:
    1. Preprocess the query.
    2. Fetch posting lists from the DB.
    3. Rank documents using TF-IDF.
    4. Extract a text snippet from the file for each result.
    5. Return a structured response dict.
"""

from app.core.preprocessor import preprocess
from app.core.ranker import compute_tfidf_scores
from app.db import crud

# Characters of context to show on each side of the first match position.
SNIPPET_RADIUS = 150


def _extract_snippet(text: str, positions: dict) -> str:
    """
    Slice a short excerpt from *text* centred on the earliest matched position.

    Args:
        text:      Full document text (read from disk).
        positions: { term: [char_offset, ...] } for the matched terms.

    Returns:
        A plain-text snippet with ellipsis if the excerpt was cut.
    """
    all_positions = [pos for pos_list in positions.values() for pos in pos_list]

    if not all_positions:
        # No position data — fall back to the document's opening.
        return (text[:300] + "...").strip() if len(text) > 300 else text.strip()

    first_pos = min(all_positions)
    start = max(0, first_pos - SNIPPET_RADIUS)
    end = min(len(text), first_pos + SNIPPET_RADIUS)

    snippet = text[start:end].strip()
    if start > 0:
        snippet = "..." + snippet
    if end < len(text):
        snippet = snippet + "..."

    return snippet


def search(query: str, top_k: int = 10) -> dict:
    """
    Execute a search query and return ranked results with snippets.

    Args:
        query: Raw query string from the client.
        top_k: Maximum number of results to return.

    Returns:
        {
            "query": str,
            "total_results": int,
            "results": [ {doc_id, filename, score, snippet, matched_terms}, ... ]
        }
    """
    empty_response = {"query": query, "total_results": 0, "results": []}

    # Step 1: Preprocess query (same pipeline as document indexing).
    query_terms = preprocess(query)
    if not query_terms:
        return empty_response

    # Step 2: Fetch posting lists for the query terms from the DB.
    postings = crud.get_postings_for_terms(query_terms)
    if not postings:
        return empty_response

    # Step 3: Rank using TF-IDF.
    total_documents = crud.get_total_document_count()
    ranked = compute_tfidf_scores(query_terms, postings, total_documents)
    ranked = ranked[:top_k]

    # Step 4: Enrich each result with document metadata and a snippet.
    results = []
    for hit in ranked:
        doc = crud.get_document_by_id(hit["doc_id"])
        if not doc:
            continue

        # Read file only for snippet extraction (the file is already on disk).
        try:
            with open(doc["filepath"], encoding="utf-8") as f:
                text = f.read()
        except FileNotFoundError:
            text = ""

        snippet = _extract_snippet(text, hit["positions"])

        results.append({
            "doc_id": hit["doc_id"],
            "filename": doc["filename"],
            "score": hit["score"],
            "snippet": snippet,
            "matched_terms": hit["matched_terms"],
        })

    return {
        "query": query,
        "total_results": len(results),
        "results": results,
    }
