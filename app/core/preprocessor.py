"""
core/preprocessor.py
--------------------
Pure text processing pipeline. No database or HTTP dependencies.

Pipeline stages (in order):
    1. clean_text    — lowercase, strip punctuation and digits
    2. tokenize      — split on whitespace
    3. remove_stop_words — filter common English function words

preprocess()                 -> final token list (for query processing)
preprocess_with_positions()  -> term → {tf, positions} map (for indexing)
"""

import re
from typing import List, Dict

# Hardcoded English stop-word list — no external dependencies required.
STOP_WORDS: frozenset = frozenset({
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "it", "its", "as", "was", "are",
    "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "will", "would", "could", "should", "may", "might", "shall", "can",
    "not", "no", "nor", "so", "yet", "both", "either", "neither", "that",
    "this", "these", "those", "i", "me", "my", "we", "our", "you", "your",
    "he", "him", "his", "she", "her", "they", "them", "their", "what",
    "which", "who", "whom", "when", "where", "why", "how", "all", "any",
    "each", "few", "more", "most", "other", "some", "such", "than", "then",
    "too", "very", "just", "also", "up", "out", "if", "about", "into",
    "through", "during", "before", "after", "above", "below", "between",
    "s", "t", "re", "ve", "ll", "d", "m",
})


def clean_text(text: str, case_sensitive: bool = False) -> str:
    """
    Stage 1: Lowercase (if not case_sensitive) → replace punctuation with spaces → collapse whitespace.
    Digits are removed to avoid noise tokens like '2024', '3rd', etc.
    """
    if not case_sensitive:
        text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)   # punctuation → space
    text = re.sub(r"\b\d+\b", " ", text)   # standalone digit sequences → space
    text = re.sub(r"\s+", " ", text).strip()
    return text


def tokenize(text: str) -> List[str]:
    """Stage 2: Split the cleaned text on whitespace."""
    return text.split()


def remove_stop_words(
    tokens: List[str],
    case_sensitive: bool = False,
    stop_words_enabled: bool = True,
) -> List[str]:
    """Stage 3: Drop stop words and single-character tokens (if enabled)."""
    if not stop_words_enabled:
        return [t for t in tokens if len(t) > 0]
    return [t for t in tokens if (t.lower() if case_sensitive else t) not in STOP_WORDS and len(t) > 1]


def preprocess(
    text: str,
    case_sensitive: bool = False,
    stop_words_enabled: bool = True,
) -> List[str]:
    """
    Full pipeline returning a list of tokens.
    Used at query time (no position tracking needed).
    """
    cleaned = clean_text(text, case_sensitive=case_sensitive)
    tokens = tokenize(cleaned)
    return remove_stop_words(
        tokens,
        case_sensitive=case_sensitive,
        stop_words_enabled=stop_words_enabled,
    )


def preprocess_with_positions(
    text: str,
    case_sensitive: bool = False,
    stop_words_enabled: bool = True,
) -> Dict[str, dict]:
    """
    Full pipeline returning term metadata for indexing.

    Returns:
        { term: {"tf": int, "positions": [char_offset, ...]} }

    Positions are character offsets into the *original* (uncleaned) text,
    used later to extract search result snippets without re-reading the file.
    """
    term_data: Dict[str, dict] = {}
    cleaned = clean_text(text, case_sensitive=case_sensitive)
    tokens = tokenize(cleaned)
    target_text = text if case_sensitive else text.lower()

    search_start = 0
    for token in tokens:
        # Find this token's position in the target text.
        idx = target_text.find(token, search_start)
        if idx == -1:
            continue
        search_start = idx + len(token)

        # Skip stop words and single-char tokens (after position cursor is advanced).
        if stop_words_enabled:
            check_term = token.lower() if case_sensitive else token
            if check_term in STOP_WORDS or len(token) <= 1:
                continue
        elif len(token) == 0:
            continue

        if token not in term_data:
            term_data[token] = {"tf": 0, "positions": []}
        term_data[token]["tf"] += 1
        term_data[token]["positions"].append(idx)

    return term_data
