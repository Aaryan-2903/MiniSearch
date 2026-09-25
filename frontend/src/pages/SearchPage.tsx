/**
 * SearchPage.tsx
 * --------------
 * Search home (no active query): heading, search input, index stats row,
 * quick filters, and a recently-added documents list.
 * When a query is entered, live results are shown inline.
 */

import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { api } from "../lib/api";
import type { SearchResponse, SearchResultItem, IndexStats, DocFile } from "../lib/api";
import { formatFileSize, formatDate } from "../lib/utils";

interface SearchPageProps {
  stats: IndexStats | null;
  recentDocs: DocFile[];
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
            {isHigh ? "Strong match" : "Partial match"}
          </span>
        </span>
      </div>

      <div className="why-grid">
        {/* Score */}
        <div className="why-cell">
          <span className="text-label-sm" style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-outline)" }}>
            TF-IDF Score
          </span>
          <span className="text-headline-sm" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
            {scorePercent(item.score)}
          </span>
          <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)", marginTop: "4px" }}>
            {item.score.toFixed(4)} raw score
          </span>
        </div>

        {/* Matched terms */}
        <div className="why-cell">
          <span className="text-label-sm" style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-outline)" }}>
            Matched Terms
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
            {item.matched_terms.slice(0, 4).map((t) => (
              <div key={t} style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="text-mono-meta" style={{ color: "var(--color-on-surface)" }}>{t}</span>
                <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>matched</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ranking signals */}
        <div className="why-cell">
          <span className="text-label-sm" style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-outline)" }}>
            Ranking Signals
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: isHigh ? "var(--color-secondary)" : "var(--color-outline)", flexShrink: 0 }} />
              <span className="text-body-sm" style={{ color: "var(--color-on-surface-variant)" }}>
                {item.matched_terms.length} of {item.matched_terms.length} query terms present
              </span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: isHigh ? "var(--color-secondary)" : "var(--color-outline)", flexShrink: 0 }} />
              <span className="text-body-sm" style={{ color: "var(--color-on-surface-variant)" }}>
                {pctVal >= 70 ? "High term density" : pctVal >= 40 ? "Moderate term density" : "Low term density"}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Confidence bar */}
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
          <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>Confidence</span>
          <span className="text-mono-meta" style={{ color: "var(--color-on-surface)", fontWeight: 600 }}>
            {pctVal >= 70 ? "High precision · " : pctVal >= 40 ? "Moderate · " : "Low · "}
            Normalized {item.score.toFixed(3)}
          </span>
        </div>
        <ScoreBar score={item.score} />
      </div>
    </div>
  );
}

function ResultCard({ item, isFirst }: { item: SearchResultItem; isFirst: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const pct = Math.min(Math.round(item.score * 100), 100);
  const isHigh = pct >= 70;

  // Highlight matched terms in snippet
  function renderSnippet(raw: string) {
    if (!item.matched_terms.length) return raw;
    const escaped = item.matched_terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const re = new RegExp(`(${escaped.join("|")})`, "gi");
    const parts = raw.split(re);
    return parts.map((part, i) =>
      re.test(part) ? <mark key={i}>{part}</mark> : part
    );
  }

  return (
    <article className="result-card" id={`result-${item.doc_id}`}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-md)" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="icon" style={{ fontSize: "16px", color: isFirst ? "var(--color-primary)" : "var(--color-outline)" }}>description</span>
            <h2 className="text-headline-sm" style={{ color: "var(--color-on-surface)", fontWeight: 600, letterSpacing: "-0.01em" }}>
              {item.filename}
            </h2>
          </div>
          <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)", marginTop: "2px" }}>
            {item.filename}
          </span>
        </div>
        <div style={{ flexShrink: 0 }}>
          <span className={isHigh ? "score-badge score-badge-high" : "score-badge score-badge-low"}>
            {pct}% match
          </span>
        </div>
      </div>

      {/* Snippet */}
      <div className="snippet">
        …{renderSnippet(item.snippet)}…
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

export function SearchPage({ stats, recentDocs, onViewDocument }: SearchPageProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

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
    debounceRef.current = setTimeout(() => doSearch(q), 300);
  }

  async function doSearch(q: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.search(q);
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
      doSearch(query);
    }
  }

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

        {/* Stats row */}
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
            {/* Results meta */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px" }}>
              <span className="text-body-sm" style={{ color: "var(--color-on-surface-variant)", fontWeight: 500 }}>
                {results.total_results} result{results.total_results !== 1 ? "s" : ""} found
              </span>
              <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
                Sorted by Relevance (TF-IDF)
              </span>
            </div>

            {results.total_results === 0 ? (
              <div className="empty-state">
                <span className="icon" style={{ fontSize: "32px", color: "var(--color-outline)" }}>search_off</span>
                <span className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                  No results for "{results.query}"
                </span>
              </div>
            ) : (
              results.results.map((item, i) => (
                <ResultCard key={item.doc_id} item={item} isFirst={i === 0} />
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
