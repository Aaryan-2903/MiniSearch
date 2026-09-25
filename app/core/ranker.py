"""
core/ranker.py
--------------
TF-IDF relevance ranking. Pure function — no database or HTTP access.

Formula used:
    TF(t, d)     = raw count of term t in document d           (stored in postings table)
    IDF(t)       = log((N + 1) / (df(t) + 1)) + 1             (smoothed to avoid div-by-zero)
                   where N    = total documents in corpus
                         df   = number of documents containing term t
    TF-IDF(t, d) = TF(t, d) × IDF(t)
    score(d)     = Σ TF-IDF(t, d)  for each matched query term t

Query semantics: OR — a document scores if it contains ANY query term.
Results are sorted by descending score.
"""

import math
from typing import List, Dict


def compute_tfidf_scores(
    query_terms: List[str],
    postings: Dict[str, list],
    total_documents: int,
) -> List[dict]:
    """
    Rank documents using TF-IDF for a set of query terms.

    Args:
        query_terms:     Preprocessed query tokens.
        postings:        { term: [ {"doc_id": int, "tf": int, "positions": [...]}, ... ] }
                         (fetched from DB for only the terms present in the query)
        total_documents: Total number of documents in the corpus (N).

    Returns:
        List of result dicts sorted by score descending:
        [
            {
                "doc_id": int,
                "score": float,
                "matched_terms": [str, ...],
                "positions": { term: [char_offset, ...] },
            },
            ...
        ]
    """
    if total_documents == 0 or not postings:
        return []

    doc_scores: Dict[int, float] = {}
    doc_matched_terms: Dict[int, set] = {}
    doc_positions: Dict[int, dict] = {}

    for term, posting_list in postings.items():
        df = len(posting_list)                              # document frequency
        idf = math.log((total_documents + 1) / (df + 1)) + 1  # smoothed IDF

        for entry in posting_list:
            doc_id = entry["doc_id"]
            tf = entry["tf"]
            tfidf = tf * idf

            doc_scores[doc_id] = doc_scores.get(doc_id, 0.0) + tfidf
            doc_matched_terms.setdefault(doc_id, set()).add(term)
            doc_positions.setdefault(doc_id, {})[term] = entry["positions"]

    results = [
        {
            "doc_id": doc_id,
            "score": round(score, 4),
            "matched_terms": sorted(doc_matched_terms[doc_id]),
            "positions": doc_positions[doc_id],
        }
        for doc_id, score in doc_scores.items()
    ]

    # Primary key: score descending.
    # Secondary key: doc_id ascending — makes tie-breaking deterministic so that
    # search results are identical before and after an index rebuild.
    results.sort(key=lambda x: (-x["score"], x["doc_id"]))
    return results
