"""
tests/test_search.py
--------------------
Validates requirements 5–8:
  5.  Empty search queries are rejected cleanly.
  6.  Searches with no matching terms return a proper empty result (not an error).
  7.  OR search correctly returns documents containing any query term.
  8.  Documents with more relevant query terms rank appropriately.

Also validates the result shape: snippet, matched_terms, score.
"""

from tests.conftest import upload_txt, search


# ── Input validation ───────────────────────────────────────────────────────────

def test_empty_string_query_rejected(client):
    """
    Requirement 5a — an empty string fails Pydantic's min_length=1 constraint.
    FastAPI returns 422 Unprocessable Entity with a 'detail' field.
    """
    r = client.post("/search", json={"query": ""})
    assert r.status_code == 422
    assert "detail" in r.json()


def test_whitespace_only_query_rejected(client):
    """
    Requirement 5b — a whitespace-only query is caught by the route handler
    and rejected with HTTP 400.
    """
    r = client.post("/search", json={"query": "   "})
    assert r.status_code == 400
    assert "detail" in r.json()


def test_missing_query_field_rejected(client):
    """A request body without a 'query' field returns 422."""
    r = client.post("/search", json={"top_k": 5})
    assert r.status_code == 422
    assert "detail" in r.json()


# ── No-match handling ──────────────────────────────────────────────────────────

def test_no_matching_terms_returns_empty_not_error(client):
    """
    Requirement 6 — when no document contains any query term the response
    must be HTTP 200 with total_results=0, not a 4xx/5xx error.
    """
    upload_txt(client, "about_python.txt", "Python is a programming language.")

    r = search(client, "zyxwvutsrqponm")  # guaranteed non-existent term
    assert r.status_code == 200
    body = r.json()
    assert body["total_results"] == 0
    assert body["results"] == []
    assert "query" in body


def test_all_stop_words_query_returns_empty(client):
    """
    A query composed entirely of stop words preprocesses to zero tokens.
    The response must be 200 with empty results (not an error).
    """
    upload_txt(client, "text.txt", "Some document content.")
    r = search(client, "the and or but")
    assert r.status_code == 200
    assert r.json()["total_results"] == 0


# ── OR semantics ───────────────────────────────────────────────────────────────

def test_or_search_returns_docs_with_any_term(client):
    """
    Requirement 7 — a query "quantum jazz" should return:
      - doc1 (contains "quantum", not "jazz")
      - doc2 (contains "jazz", not "quantum")
    Neither doc needs to contain both terms.
    """
    upload_txt(client, "physics.txt",
               "Quantum entanglement is a phenomenon in physics where particles "
               "become correlated regardless of distance.")
    upload_txt(client, "music.txt",
               "Jazz improvisation relies on spontaneous melodic invention over "
               "chord progressions.")

    r = search(client, "quantum jazz")
    assert r.status_code == 200
    body = r.json()
    assert body["total_results"] == 2

    returned_filenames = {res["filename"] for res in body["results"]}
    assert "physics.txt" in returned_filenames
    assert "music.txt" in returned_filenames


def test_or_search_single_term_match(client):
    """With two docs, a single-term query returns only the doc containing it."""
    upload_txt(client, "alpha.txt", "Blockchain consensus mechanisms.")
    upload_txt(client, "beta.txt",  "Neural network activation functions.")

    r = search(client, "blockchain")
    assert r.status_code == 200
    results = r.json()["results"]
    assert len(results) == 1
    assert results[0]["filename"] == "alpha.txt"


# ── Relevance ranking ──────────────────────────────────────────────────────────

def test_higher_term_frequency_ranks_higher(client):
    """
    Requirement 8 — with equal IDF (same df), the document with the higher
    raw term frequency must receive a higher TF-IDF score and rank first.

    doc_high:  "python" appears 5 times → higher TF → higher score
    doc_low:   "python" appears once    → lower TF  → lower score
    """
    upload_txt(client, "high_tf.txt",
               "Python python python python python is the topic of this document.")
    upload_txt(client, "low_tf.txt",
               "Python is mentioned once alongside many other programming concepts.")

    r = search(client, "python")
    assert r.status_code == 200
    results = r.json()["results"]

    assert len(results) == 2
    assert results[0]["filename"] == "high_tf.txt", \
        f"Expected high_tf.txt first, got {results[0]['filename']} " \
        f"(scores: {[res['score'] for res in results]})"
    assert results[0]["score"] > results[1]["score"]


def test_multi_term_match_ranks_higher_than_single_term(client):
    """
    A document matching more query terms accumulates a higher combined TF-IDF
    score and should rank above one that matches fewer terms.

    Query: "python search"
    doc_both:  contains both "python" and "search"
    doc_one:   contains only "python"
    """
    upload_txt(client, "both_terms.txt",
               "Python is used to build search engines and information retrieval systems.")
    upload_txt(client, "one_term.txt",
               "Python is widely used in scientific computing and data analysis.")

    r = search(client, "python search")
    assert r.status_code == 200
    results = r.json()["results"]

    assert len(results) == 2
    assert results[0]["filename"] == "both_terms.txt", \
        f"Expected both_terms.txt first, got {results[0]['filename']}"
    assert results[0]["score"] > results[1]["score"]


# ── Result shape ───────────────────────────────────────────────────────────────

def test_search_result_contains_required_fields(client):
    """Every result item must include doc_id, filename, score, snippet, matched_terms."""
    upload_txt(client, "shape_test.txt",
               "Distributed systems require careful coordination and fault tolerance.")

    results = search(client, "distributed systems").json()["results"]
    assert len(results) >= 1
    result = results[0]

    assert "doc_id" in result
    assert "filename" in result
    assert "score" in result
    assert "snippet" in result
    assert "matched_terms" in result


def test_matched_terms_are_subset_of_query_tokens(client):
    """matched_terms must only contain tokens that actually appear in the document."""
    upload_txt(client, "subset.txt",
               "Cryptography secures communication over insecure networks.")

    results = search(client, "cryptography quantum").json()["results"]
    # "quantum" is not in the document, so matched_terms should only contain
    # terms that ARE in the document.
    assert len(results) >= 1
    matched = results[0]["matched_terms"]
    assert "cryptography" in matched
    assert "quantum" not in matched  # not present in the document


def test_snippet_is_non_empty_string(client):
    """The snippet field must be a non-empty string for every result."""
    upload_txt(client, "snippet_doc.txt",
               "Elasticsearch provides distributed full-text search capabilities "
               "using inverted indexes and scoring algorithms.")

    results = search(client, "inverted indexes").json()["results"]
    assert len(results) >= 1
    for res in results:
        assert isinstance(res["snippet"], str)
        assert len(res["snippet"]) > 0


def test_top_k_limits_results(client):
    """top_k must cap the number of returned results."""
    # Upload 5 docs each containing the query term.
    for i in range(5):
        upload_txt(client, f"doc_{i}.txt", f"Microservices architecture document number {i} with details.")

    results = search(client, "microservices", top_k=2).json()["results"]
    assert len(results) <= 2


def test_score_is_positive_float(client):
    """TF-IDF score must be a positive number for any matched document."""
    upload_txt(client, "positive.txt", "Concurrency parallelism threading multiprocessing.")
    results = search(client, "concurrency parallelism").json()["results"]
    assert len(results) >= 1
    for res in results:
        assert isinstance(res["score"], float)
        assert res["score"] > 0


# ── Match Mode (Any term vs All terms) ─────────────────────────────────────────

def test_default_match_mode_is_any(client):
    """When match_mode is omitted, default behavior remains any-term (OR)."""
    upload_txt(client, "doc_py.txt", "Python programming language.")
    upload_txt(client, "doc_db.txt", "Relational database systems.")

    r = client.post("/search", json={"query": "python database"})
    assert r.status_code == 200
    body = r.json()
    assert body["match_mode"] == "any"
    assert body["total_results"] == 2


def test_match_mode_any_explicit(client):
    """Explicit match_mode='any' returns documents matching either term."""
    upload_txt(client, "doc1.txt", "Python is interpreted.")
    upload_txt(client, "doc2.txt", "Java is compiled.")

    r = search(client, "python java", match_mode="any")
    assert r.status_code == 200
    body = r.json()
    assert body["match_mode"] == "any"
    assert body["total_results"] == 2
    filenames = {res["filename"] for res in body["results"]}
    assert "doc1.txt" in filenames
    assert "doc2.txt" in filenames


def test_match_mode_all_requires_every_term(client):
    """match_mode='all' excludes documents that do not contain every query term."""
    upload_txt(client, "doc_both.txt", "Python and database working together.")
    upload_txt(client, "doc_only_py.txt", "Python without any storage.")
    upload_txt(client, "doc_only_db.txt", "Database without any scripting.")

    r = search(client, "python database", match_mode="all")
    assert r.status_code == 200
    body = r.json()
    assert body["match_mode"] == "all"
    assert body["total_results"] == 1
    assert body["results"][0]["filename"] == "doc_both.txt"
    assert set(body["results"][0]["matched_terms"]) == {"python", "database"}


def test_match_mode_all_no_document_matching_every_term(client):
    """When no single document contains every term, match_mode='all' returns empty results."""
    upload_txt(client, "only_a.txt", "Python programming scripts.")
    upload_txt(client, "only_b.txt", "Database query optimization.")

    r = search(client, "python database", match_mode="all")
    assert r.status_code == 200
    body = r.json()
    assert body["match_mode"] == "all"
    assert body["total_results"] == 0
    assert body["results"] == []


# ── TF-IDF Explanation & Search Metadata ──────────────────────────────────────

def test_tfidf_explanation_contains_real_values(client):
    """Results must contain real explanation metrics from the backend."""
    upload_txt(client, "doc_calc.txt", "Python python programming language.")
    upload_txt(client, "doc_other.txt", "Language syntax grammar.")

    r = search(client, "python programming")
    assert r.status_code == 200
    results = r.json()["results"]
    assert len(results) >= 1

    item = next(res for res in results if res["filename"] == "doc_calc.txt")
    exp = item["explanation"]
    assert exp is not None
    assert exp["total_documents"] == 2
    assert exp["query_terms_count"] == 2
    assert exp["matched_terms_count"] == 2

    # Check term details
    terms = {t["term"]: t for t in exp["term_details"]}
    assert "python" in terms
    assert "programming" in terms
    assert terms["python"]["tf"] == 2
    assert terms["python"]["df"] == 1
    assert terms["python"]["idf"] > 0
    assert terms["python"]["tfidf"] > 0
    assert terms["programming"]["tf"] == 1
    assert terms["programming"]["df"] == 1


def test_search_metadata_fields(client):
    """Search response includes execution_time_ms, query_terms_count, and ranking_method."""
    upload_txt(client, "meta_doc.txt", "Search metadata test document.")

    r = search(client, "metadata test")
    assert r.status_code == 200
    body = r.json()
    assert "execution_time_ms" in body
    assert isinstance(body["execution_time_ms"], (int, float))
    assert body["query_terms_count"] == 2
    assert body["ranking_method"] == "TF-IDF"

