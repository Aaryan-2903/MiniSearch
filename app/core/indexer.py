"""
core/indexer.py
---------------
Builds an in-memory inverted index from a list of preprocessed documents.
Pure function — no database or HTTP access.

Inverted Index structure:
    {
        "python": [
            {"doc_id": 1, "tf": 3, "positions": [12, 87, 204]},
            {"doc_id": 4, "tf": 1, "positions": [55]},
        ],
        "search": [ ... ],
        ...
    }

This in-memory representation is used during bulk rebuilds.
For normal uploads the postings are inserted per-document directly from
preprocess_with_positions() output without passing through this function.
"""

from typing import List, Dict


def build_index(documents: List[dict]) -> Dict[str, list]:
    """
    Build a full inverted index from a list of processed documents.

    Args:
        documents: [
            {
                "doc_id": int,
                "term_data": {
                    term: {"tf": int, "positions": [int, ...]}
                }
            },
            ...
        ]

    Returns:
        { term: [ {"doc_id": int, "tf": int, "positions": [...]}, ... ] }
    """
    index: Dict[str, list] = {}

    for doc in documents:
        doc_id = doc["doc_id"]
        for term, data in doc["term_data"].items():
            index.setdefault(term, []).append({
                "doc_id": doc_id,
                "tf": data["tf"],
                "positions": data["positions"],
            })

    return index
