/**
 * SearchPage.tsx
 * --------------
 * Search home (no active query): heading, search input, index stats row,
 * quick filters, and a recently-added documents list.
 * When a query is entered, live results are shown inline with TF-IDF ranking,
 * match mode toggling (any/all), multi-term highlighting, and detailed explanation.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import type { KeyboardEvent } from "react";
import { api } from "../lib/api";
import type { SearchResponse, SearchResultItem, IndexStats, DocFile, Folder } from "../lib/api";
import { formatFileSize, scorePercent } from "../lib/utils";

interface SearchPageProps {
  stats: IndexStats | null;
  recentDocs: DocFile[];
  folders?: Folder[];
  onViewDocument: (doc: DocFile) => void;
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(score * 100, 100);
  return (
    <div className="conf-bar" style={{ marginTop: "4px" }}>
      <div className="conf-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

function WhyPanel({ item }: { item: SearchResultItem }) {
  const exp = item.explanation;
  const pctVal = Math.min(item.score * 100, 100);
  const isHigh = pctVal >= 70;

  return (
    <div className="why-panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="text-mono-meta" style={{ textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, color: "var(--color-on-surface)" }}>
          Relevance Breakdown
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: isHigh ? "var(--color-secondary)" : "var(--color-outline)",
            }}
          />
          <span className="text-mono-meta" style={{ color: isHigh ? "var(--color-secondary)" : "var(--color-outline)" }}>
            {isHigh ? "High relevance" : "Moderate relevance"}
          </span>
        </span>
      </div>

      <div className="why-grid">
        {/* Total Score */}
        <div className="why-cell">
          <span className="text-label-sm" style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-outline)" }}>
            Total Score
          </span>
          <span className="text-headline-sm" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
            {scorePercent(item.score)}
          </span>
          <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)", marginTop: "4px" }}>
            {item.score.toFixed(4)} TF-IDF
          </span>
        </div>

        {/* Coverage & Matched Terms */}
        <div className="why-cell">
          <span className="text-label-sm" style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-outline)" }}>
            Coverage
          </span>
          <span className="text-body-sm" style={{ color: "var(--color-on-surface)", fontWeight: 600, marginTop: "2px" }}>
            {exp ? `${exp.matched_terms_count} / ${exp.query_terms_count} query terms` : `${item.matched_terms.length} matched`}
          </span>
          <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)", marginTop: "4px" }}>
            Matched terms: {item.matched_terms.join(" · ")}
          </span>
        </div>

        {/* Term-by-term details */}
        <div className="why-cell" style={{ gridColumn: "1 / -1" }}>
          <span className="text-label-sm" style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-outline)", marginBottom: "6px" }}>
            Term Frequency · Document Frequency · TF-IDF Contribution
          </span>
          {exp && exp.term_details && exp.term_details.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
              {exp.term_details.map((td) => (
                <div
                  key={td.term}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 10px",
                    background: "var(--color-surface-container)",
                    borderRadius: "var(--radius-xs)",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <span className="text-mono-meta" style={{ color: "var(--color-on-surface)", fontWeight: 600 }}>
                    {td.term}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                    <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
                      Term frequency: <strong style={{ color: "var(--color-on-surface)" }}>{td.tf}</strong>
                    </span>
                    <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
                      Document frequency: <strong style={{ color: "var(--color-on-surface)" }}>{td.df} / {exp.total_documents}</strong>
                    </span>
                    <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
                      TF-IDF contribution: <strong style={{ color: "var(--color-primary)" }}>{td.tfidf.toFixed(4)}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
              {item.matched_terms.map((t) => (
                <div key={t} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-mono-meta" style={{ color: "var(--color-on-surface)" }}>{t}</span>
                  <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>matched</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Relevance Bar */}
      <div
        style={{
          background: "var(--color-surface-container-low)",
          borderRadius: "var(--radius-xs)",
          padding: "10px var(--space-sm)",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>Relevance</span>
          <span className="text-mono-meta" style={{ color: "var(--color-on-surface)", fontWeight: 600 }}>
            {isHigh ? "High relevance · " : "Moderate relevance · "}
            Score {item.score.toFixed(4)}
          </span>
        </div>
        <ScoreBar score={item.score} />
      </div>
    </div>
  );
}

function highlightSnippet(snippetText: string, terms: string[]) {
  if (!terms || terms.length === 0 || !snippetText) {
    return snippetText;
  }

  const cleanTerms = Array.from(new Set(terms.filter((t) => t.trim().length > 0)));
  if (cleanTerms.length === 0) return snippetText;

  // Sort descending by length so longer phrases/words match first
  cleanTerms.sort((a, b) => b.length - a.length);

  const escaped = cleanTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const matchSet = new Set(cleanTerms.map((t) => t.toLowerCase()));
  const parts = snippetText.split(regex);

  return parts.map((part, idx) => {
    if (matchSet.has(part.toLowerCase())) {
      return <mark key={idx}>{part}</mark>;
    }
    return part;
  });
}

function ResultCard({
  item,
  isFirst,
  onOpen,
}: {
  item: SearchResultItem;
  isFirst: boolean;
  onOpen: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = Math.min(Math.round(item.score * 100), 100);
  const isHigh = pct >= 70;

  return (
    <article className="result-card" id={`result-${item.doc_id}`}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-md)" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            onClick={onOpen}
            style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
            title="Open document"
          >
            <span className="icon" style={{ fontSize: "16px", color: isFirst ? "var(--color-primary)" : "var(--color-outline)" }}>
              description
            </span>
            <h2
              className="text-headline-sm"
              style={{
                color: "var(--color-on-surface)",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                textDecoration: "underline",
                textDecorationColor: "transparent",
                transition: "text-decoration-color 120ms",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecorationColor = "var(--color-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecorationColor = "transparent")}
            >
              {item.filename}
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px", flexWrap: "wrap" }}>
            <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
              {item.filename}
            </span>
            {item.folder_name && (
              <>
                <span className="text-mono-meta" style={{ color: "color-mix(in srgb, var(--color-on-surface-variant) 40%, transparent)" }}>/</span>
                <span
                  className="text-mono-meta"
                  style={{
                    color: "var(--color-primary)",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                  }}
                >
                  <span className="icon" style={{ fontSize: "13px" }}>folder</span>
                  {item.folder_name}
                </span>
              </>
            )}
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          <span className={isHigh ? "score-badge score-badge-high" : "score-badge score-badge-low"}>
            {pct}% match
          </span>
        </div>
      </div>

      {/* Snippet with multi-term highlighting */}
      <div className="snippet">
        …{highlightSnippet(item.snippet, item.matched_terms)}…
      </div>

      {/* Term badges + Why button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", paddingTop: "4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          {item.matched_terms.map((t) => (
            <span key={t} className="term-badge">{t}</span>
          ))}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            background: "transparent",
            border: "none",
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem",
            fontWeight: 500,
            color: expanded ? "var(--color-on-surface)" : "var(--color-primary)",
            padding: "4px 6px",
            borderRadius: "var(--radius-xs)",
            cursor: "pointer",
            transition: "color 120ms",
          }}
        >
          <span>Why this result</span>
          <span
            className="icon"
            style={{
              fontSize: "14px",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 200ms",
            }}
          >
            expand_more
          </span>
        </button>
      </div>

      {/* Expandable relevance panel */}
      {expanded && <WhyPanel item={item} />}
    </article>
  );
}

export function SearchPage({ stats, recentDocs, folders = [], onViewDocument }: SearchPageProps) {
  const [query, setQuery] = useState("");
  const [matchMode, setMatchMode] = useState<"any" | "all">("any");
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"relevance" | "name_asc" | "name_desc">("relevance");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function handleQueryChange(q: string) {
    setQuery(q);
    clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults(null);
      setError(null);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(q, matchMode, selectedFolderId), 300);
  }

  function handleMatchModeChange(mode: "any" | "all") {
    setMatchMode(mode);
    if (query.trim()) {
      clearTimeout(debounceRef.current);
      doSearch(query, mode, selectedFolderId);
    }
  }

  function handleFolderChange(folderId: number | null) {
    setSelectedFolderId(folderId);
    if (query.trim()) {
      clearTimeout(debounceRef.current);
      doSearch(query, matchMode, folderId);
    }
  }

  async function doSearch(q: string, mode: "any" | "all", folderId: number | null = selectedFolderId) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.search(q, 10, mode, folderId);
      setResults(res);
    } catch (e) {
      setError((e as Error).message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setQuery("");
      setResults(null);
      setError(null);
      inputRef.current?.blur();
    }
    if (e.key === "Enter" && query.trim()) {
      clearTimeout(debounceRef.current);
      doSearch(query, matchMode, selectedFolderId);
    }
  }

  // Sort presentation order only (does NOT modify underlying TF-IDF score)
  const displayedResults = useMemo(() => {
    if (!results) return [];
    const list = [...results.results];
    if (sortBy === "name_asc") {
      list.sort((a, b) => a.filename.localeCompare(b.filename));
    } else if (sortBy === "name_desc") {
      list.sort((a, b) => b.filename.localeCompare(a.filename));
    }
    return list;
  }, [results, sortBy]);

  const QUICK_FILTERS = ["data structures", "binary search", "async await", "inverted index"];

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      {/* Breadcrumb bar */}
      <div
        style={{
          background: "color-mix(in srgb, var(--color-surface-container-low) 60%, transparent)",
          padding: "var(--space-sm) var(--space-xl)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--color-outline-variant)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)", fontWeight: 500 }}>MiniSearch</span>
          <span className="text-mono-meta" style={{ color: "color-mix(in srgb, var(--color-on-surface-variant) 40%, transparent)" }}>/</span>
          <span className="text-mono-meta" style={{ color: "var(--color-on-surface)", fontWeight: 600 }}>Search Home</span>
        </div>
        {stats && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: stats.index_status === "ready" ? "var(--color-secondary)" : "var(--color-outline)" }} />
            <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
              Index {stats.index_status}
            </span>
          </div>
        )}
      </div>

      {/* Main content area */}
      <div style={{ width: "100%", maxWidth: "720px", margin: "0 auto", padding: "4rem var(--space-lg) 6rem", display: "flex", flexDirection: "column" }}>
        {/* Heading */}
        <div style={{ display: "flex", flexDirection: "column", marginBottom: "2rem" }}>
          <h1 className="text-headline-lg" style={{ color: "var(--color-on-surface)", fontWeight: 600, letterSpacing: "-0.02em" }}>
            Search your documents
          </h1>
          {stats && (
            <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)", marginTop: "6px" }}>
              Search across {stats.total_documents} plain text file{stats.total_documents !== 1 ? "s" : ""} and {stats.total_unique_terms.toLocaleString()} inverted index terms.
            </p>
          )}
        </div>

        {/* Search input */}
        <div style={{ position: "relative", width: "100%", display: "flex", flexDirection: "column", marginBottom: "0.75rem" }}>
          <div className="search-field">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ color: "var(--color-on-surface-variant)", flexShrink: 0 }}
            >
              <path d="M21 21l-4.35-4.35m1.85-5.65a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              ref={inputRef}
              id="search-input"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={query}
              placeholder="Search documents... (e.g. data structures, algorithms, cache)"
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {loading && (
              <span className="icon spin" style={{ fontSize: "16px", color: "var(--color-on-surface-variant)", flexShrink: 0 }}>refresh</span>
            )}
            {!loading && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                <kbd>⌘</kbd>
                <kbd>K</kbd>
              </div>
            )}
          </div>
        </div>

        {/* Search Controls: Match Mode & Folder Scope */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="text-label-sm" style={{ color: "var(--color-on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              Match:
            </span>
            <div style={{ display: "inline-flex", background: "var(--color-surface-container-low)", borderRadius: "var(--radius-xs)", padding: "2px", border: "1px solid var(--color-outline-variant)" }}>
              <button
                type="button"
                id="match-mode-any"
                onClick={() => handleMatchModeChange("any")}
                style={{
                  background: matchMode === "any" ? "var(--color-surface-container-highest)" : "transparent",
                  color: matchMode === "any" ? "var(--color-on-surface)" : "var(--color-on-surface-variant)",
                  border: "none",
                  padding: "3px 10px",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "0.75rem",
                  fontFamily: "var(--font-mono)",
                  fontWeight: matchMode === "any" ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                Any term
              </button>
              <button
                type="button"
                id="match-mode-all"
                onClick={() => handleMatchModeChange("all")}
                style={{
                  background: matchMode === "all" ? "var(--color-surface-container-highest)" : "transparent",
                  color: matchMode === "all" ? "var(--color-on-surface)" : "var(--color-on-surface-variant)",
                  border: "none",
                  padding: "3px 10px",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "0.75rem",
                  fontFamily: "var(--font-mono)",
                  fontWeight: matchMode === "all" ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                All terms
              </button>
            </div>
          </div>

          {/* Folder scope selector */}
          {folders.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label htmlFor="search-folder-select" className="text-label-sm" style={{ color: "var(--color-on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                Folder:
              </label>
              <select
                id="search-folder-select"
                value={selectedFolderId ?? ""}
                onChange={(e) => handleFolderChange(e.target.value === "" ? null : Number(e.target.value))}
                style={{
                  background: "var(--color-surface-container-low)",
                  color: "var(--color-on-surface)",
                  border: "1px solid var(--color-outline-variant)",
                  borderRadius: "var(--radius-xs)",
                  padding: "3px 8px",
                  fontSize: "0.75rem",
                  fontFamily: "var(--font-mono)",
                  cursor: "pointer",
                }}
              >
                <option value="">All folders (Global)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Stats row (when no results active) */}
        {stats && !results && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 4px", marginBottom: "2rem" }}>
            <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
              {stats.total_documents} documents
            </span>
            <span className="text-mono-meta" style={{ color: "color-mix(in srgb, var(--color-on-surface-variant) 40%, transparent)" }}>·</span>
            <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
              {stats.total_unique_terms.toLocaleString()} indexed terms
            </span>
            <span className="text-mono-meta" style={{ color: "color-mix(in srgb, var(--color-on-surface-variant) 40%, transparent)" }}>·</span>
            <span className="text-mono-meta" style={{ color: "var(--color-secondary)", fontWeight: 500 }}>
              Index {stats.index_status}
            </span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            style={{
              background: "var(--color-error-container)",
              color: "var(--color-on-error-container)",
              borderRadius: "var(--radius-xs)",
              padding: "var(--space-sm) var(--space-md)",
              marginBottom: "var(--space-md)",
            }}
            className="text-body-sm"
          >
            {error}
          </div>
        )}

        {/* Search results */}
        {results && !error && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)", marginTop: "8px", paddingBottom: "4rem" }}>
            {/* Results meta and filename sorting */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", padding: "0 2px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="text-body-sm" style={{ color: "var(--color-on-surface)", fontWeight: 500 }}>
                  {results.total_results} result{results.total_results !== 1 ? "s" : ""}
                </span>
                <span className="text-mono-meta" style={{ color: "var(--color-outline)" }}>·</span>
                <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
                  {results.execution_time_ms} ms
                </span>
                <span className="text-mono-meta" style={{ color: "var(--color-outline)" }}>·</span>
                <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
                  {results.query_terms_count} term{results.query_terms_count !== 1 ? "s" : ""} matched
                </span>
                <span className="text-mono-meta" style={{ color: "var(--color-outline)" }}>·</span>
                <span className="text-mono-meta" style={{ color: "var(--color-secondary)", fontWeight: 500 }}>
                  {results.ranking_method}
                </span>
              </div>

              {/* Filename sorting dropdown */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <label htmlFor="sort-select" className="text-label-sm" style={{ color: "var(--color-outline)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Sort:
                </label>
                <select
                  id="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "relevance" | "name_asc" | "name_desc")}
                  style={{
                    background: "var(--color-surface-container-low)",
                    color: "var(--color-on-surface)",
                    border: "1px solid var(--color-outline-variant)",
                    borderRadius: "var(--radius-xs)",
                    padding: "3px 8px",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-mono)",
                    cursor: "pointer",
                  }}
                >
                  <option value="relevance">Relevance</option>
                  <option value="name_asc">Filename A–Z</option>
                  <option value="name_desc">Filename Z–A</option>
                </select>
              </div>
            </div>

            {results.total_results === 0 ? (
              <div className="empty-state">
                <span className="icon" style={{ fontSize: "32px", color: "var(--color-outline)" }}>search_off</span>
                <span className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                  No results for "{results.query}"
                </span>
              </div>
            ) : (
              displayedResults.map((item, i) => (
                <ResultCard
                  key={item.doc_id}
                  item={item}
                  isFirst={i === 0}
                  onOpen={() =>
                    onViewDocument({
                      id: item.doc_id,
                      filename: item.filename,
                      file_size: 0,
                      token_count: 0,
                      uploaded_at: "",
                    })
                  }
                />
              ))
            )}
          </div>
        )}

        {/* No query: quick filters + recently added */}
        {!results && !error && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "2.5rem" }}>
              <div
                className="text-label-sm"
                style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-on-surface-variant)", fontWeight: 600, padding: "0 4px" }}
              >
                Quick Filters
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", paddingTop: "4px" }}>
                {QUICK_FILTERS.map((f) => (
                  <button
                    key={f}
                    className="quick-filter"
                    onClick={() => { setQuery(f); handleQueryChange(f); inputRef.current?.focus(); }}
                  >
                    <span className="hash">#</span>
                    <span>{f}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recently added */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "8px", padding: "0 4px 8px" }}>
                <span
                  className="text-label-sm"
                  style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-on-surface-variant)", fontWeight: 600 }}
                >
                  Recently Added
                </span>
                <span className="text-mono-meta" style={{ color: "color-mix(in srgb, var(--color-on-surface-variant) 70%, transparent)" }}>
                  Sorted by ingestion
                </span>
              </div>

              {recentDocs.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center" }}>
                  <span className="text-body-sm" style={{ color: "var(--color-on-surface-variant)" }}>
                    No documents yet. Upload some .txt files to get started.
                  </span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {recentDocs.slice(0, 5).map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => onViewDocument(doc)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px var(--space-md)",
                        borderRadius: "var(--radius-sm)",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background 120ms",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-container-low)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                        <span className="icon" style={{ fontSize: "16px", color: "var(--color-on-surface-variant)" }}>description</span>
                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                          <span className="text-headline-sm" style={{ color: "var(--color-on-surface)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {doc.filename}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                            <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>{doc.filename}</span>
                            {doc.folder_name && (
                              <>
                                <span className="text-mono-meta" style={{ color: "color-mix(in srgb, var(--color-on-surface-variant) 40%, transparent)" }}>/</span>
                                <span className="text-mono-meta" style={{ color: "var(--color-primary)", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "2px" }}>
                                  <span className="icon" style={{ fontSize: "12px" }}>folder</span>
                                  {doc.folder_name}
                                </span>
                              </>
                            )}
                            <span className="text-mono-meta" style={{ color: "color-mix(in srgb, var(--color-on-surface-variant) 40%, transparent)" }}>·</span>
                            <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>{formatFileSize(doc.file_size)}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                        <span className="text-mono-meta" style={{ padding: "2px 8px", borderRadius: "var(--radius-xs)", background: "var(--color-surface-container)", color: "var(--color-secondary)", fontWeight: 500 }}>
                          Indexed
                        </span>
                        <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
                          {doc.token_count.toLocaleString()} terms
                        </span>
                        <span className="icon" style={{ fontSize: "16px", color: "color-mix(in srgb, var(--color-on-surface-variant) 40%, transparent)" }}>chevron_right</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Keyboard hints footer */}
      <div className="kbd-bar">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)", color: "var(--color-on-surface-variant)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <kbd>↑</kbd><kbd>↓</kbd>
            <span className="text-mono-meta">navigate</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <kbd>↵</kbd>
            <span className="text-mono-meta">search</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <kbd>esc</kbd>
            <span className="text-mono-meta">clear search</span>
          </div>
        </div>
        {stats && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-secondary)" }} />
            <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
              In-memory index synced
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
