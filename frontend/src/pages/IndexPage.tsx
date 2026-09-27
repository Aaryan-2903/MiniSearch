/**
 * IndexPage.tsx
 * -------------
 * Search Index Diagnostics & Engine Settings.
 * Technical diagnostic/index information page:
 * - Real-time inverted index stats (documents, unique terms, storage size, status)
 * - Index architecture details and postings format
 * - Index rebuild tool with immediate feedback
 * - Settings tab with clean configuration rows and subtle dividers
 */

import { useState, useEffect } from "react";
import type { IndexStats } from "../lib/api";
import { api } from "../lib/api";
import { formatDate, formatFileSize } from "../lib/utils";

interface IndexPageProps {
  stats: IndexStats | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  initialTab?: "index" | "settings";
  totalSize?: number;
}

export function IndexPage({
  stats,
  loading,
  error,
  onRefresh,
  initialTab = "index",
  totalSize,
}: IndexPageProps) {
  const [activeTab, setActiveTab] = useState<"index" | "settings">(initialTab);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildResult, setRebuildResult] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  async function handleRebuild() {
    if (rebuilding) return;
    setRebuilding(true);
    setRebuildResult(null);
    try {
      const res = await api.rebuildIndex();
      setRebuildResult(
        `Rebuilt ${res.total_documents} documents · ${res.total_unique_terms.toLocaleString()} unique terms · completed at ${formatDate(res.rebuilt_at)}`
      );
      onRefresh();
    } catch (e) {
      setRebuildResult(`Error: ${(e as Error).message}`);
    } finally {
      setRebuilding(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      {/* Header with Title and Tabs */}
      <div
        style={{
          background: "var(--color-background)",
          padding: "1.75rem var(--space-xl) 0",
          borderBottom: "1px solid var(--color-outline-variant)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-md)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <h1 className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>
              {activeTab === "index" ? "Search Index" : "Engine Settings"}
            </h1>
            <p className="text-body-sm" style={{ color: "var(--color-on-surface-variant)" }}>
              {activeTab === "index"
                ? "Diagnostic health, term postings, and inverted index state."
                : "Configuration and search pipeline processing parameters."}
            </p>
          </div>

          {stats && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "3px 8px",
                borderRadius: "var(--radius-xs)",
                background: "var(--color-surface-container-low)",
                border: "1px solid var(--color-outline-variant)",
                color: "var(--color-on-surface-variant)",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: stats.index_status === "ready" ? "var(--color-secondary)" : "var(--color-outline)",
                }}
              />
              <span className="text-mono-meta">
                {stats.index_status === "ready" ? "Index ready" : stats.index_status}
              </span>
            </div>
          )}
        </div>

        {/* Tab navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)", marginTop: "1.25rem" }}>
          <button
            className={`tab-btn${activeTab === "index" ? " active" : ""}`}
            onClick={() => setActiveTab("index")}
          >
            <span className="icon" style={{ fontSize: "16px" }}>account_tree</span>
            <span>Inverted Index</span>
          </button>
          <button
            className={`tab-btn${activeTab === "settings" ? " active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            <span className="icon" style={{ fontSize: "16px" }}>tune</span>
            <span>Engine Configuration</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div style={{ padding: "1.75rem var(--space-xl)", maxWidth: "860px", width: "100%", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Loading state */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <span className="icon spin" style={{ fontSize: "22px", color: "var(--color-on-surface-variant)" }}>refresh</span>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="error-state">
            <span className="icon" style={{ fontSize: "28px", color: "var(--color-error)" }}>error</span>
            <span className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>{error}</span>
            <button className="btn-ghost" onClick={onRefresh}>Retry</button>
          </div>
        )}

        {!loading && !error && stats && (
          <>
            {/* ── TAB 1: Inverted Index Diagnostics ── */}
            {activeTab === "index" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* Compact Technical Metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
                  <div className="stat-cell">
                    <span className="text-label-sm" style={{ color: "var(--color-outline)" }}>
                      Documents Indexed
                    </span>
                    <div style={{ marginTop: "10px", display: "flex", alignItems: "baseline", gap: "6px" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "1.5rem", fontWeight: 600, color: "var(--color-on-surface)" }}>
                        {stats.total_documents}
                      </span>
                      <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>.txt files</span>
                    </div>
                  </div>

                  <div className="stat-cell">
                    <span className="text-label-sm" style={{ color: "var(--color-outline)" }}>
                      Unique Terms
                    </span>
                    <div style={{ marginTop: "10px", display: "flex", alignItems: "baseline", gap: "6px" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "1.5rem", fontWeight: 600, color: "var(--color-on-surface)" }}>
                        {stats.total_unique_terms.toLocaleString()}
                      </span>
                      <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>postings</span>
                    </div>
                  </div>

                  {totalSize !== undefined && (
                    <div className="stat-cell">
                      <span className="text-label-sm" style={{ color: "var(--color-outline)" }}>
                        Storage Size
                      </span>
                      <div style={{ marginTop: "10px", display: "flex", alignItems: "baseline", gap: "6px" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "1.5rem", fontWeight: 600, color: "var(--color-on-surface)" }}>
                          {formatFileSize(totalSize)}
                        </span>
                        <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>on disk</span>
                      </div>
                    </div>
                  )}

                  <div className="stat-cell">
                    <span className="text-label-sm" style={{ color: "var(--color-outline)" }}>
                      Index Status
                    </span>
                    <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          width: "7px",
                          height: "7px",
                          borderRadius: "50%",
                          background: stats.index_status === "ready" ? "var(--color-secondary)" : "var(--color-outline)",
                        }}
                      />
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "1.1rem",
                          fontWeight: 500,
                          color: stats.index_status === "ready" ? "var(--color-secondary)" : "var(--color-on-surface)",
                          textTransform: "capitalize",
                        }}
                      >
                        {stats.index_status}
                      </span>
                    </div>
                  </div>

                  <div className="stat-cell">
                    <span className="text-label-sm" style={{ color: "var(--color-outline)" }}>
                      Last Rebuilt
                    </span>
                    <div style={{ marginTop: "10px" }}>
                      <span className="text-mono-meta" style={{ fontWeight: 500, color: "var(--color-on-surface)" }}>
                        {stats.last_built_at ? formatDate(stats.last_built_at) : "Synchronous"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Inverted Index Technical Architecture */}
                <div
                  style={{
                    background: "var(--color-background)",
                    border: "1px solid var(--color-outline-variant)",
                    borderRadius: "var(--radius-sm)",
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <h2 className="text-headline-sm" style={{ color: "var(--color-on-surface)" }}>
                    Inverted Index Structure
                  </h2>
                  <p className="text-body-sm" style={{ color: "var(--color-on-surface-variant)", lineHeight: 1.5 }}>
                    The index tokenizes uploaded plaintext, applies lowercase folding and stopword filtering, and builds a postings table mapping each normalized token to document IDs and term occurrence frequencies. Query evaluation computes normalized term frequency (TF) and inverse document frequency (IDF) for deterministic cosine-like relevance ranking.
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                    <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
                      Posting Format:
                    </span>
                    <code>DocID : TermFrequency</code>
                  </div>
                </div>

                {/* Index Management / Rebuild */}
                <div
                  style={{
                    background: "var(--color-surface-container-low)",
                    border: "1px solid var(--color-outline-variant)",
                    borderRadius: "var(--radius-sm)",
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <h2 className="text-headline-sm" style={{ color: "var(--color-on-surface)" }}>
                      Index Rebuild
                    </h2>
                    <p className="text-body-sm" style={{ color: "var(--color-on-surface-variant)" }}>
                      Reprocess all documents in the database and regenerate inverted index postings table.
                    </p>
                  </div>

                  <div>
                    <button
                      className="btn-primary"
                      onClick={handleRebuild}
                      disabled={rebuilding}
                      style={{ opacity: rebuilding ? 0.7 : 1 }}
                    >
                      <span className={`icon${rebuilding ? " spin" : ""}`} style={{ fontSize: "15px" }}>refresh</span>
                      <span>{rebuilding ? "Rebuilding..." : "Rebuild inverted index"}</span>
                    </button>
                  </div>

                  {rebuildResult && (
                    <div className="rebuild-banner">
                      <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: rebuildResult.startsWith("Error") ? "var(--color-error)" : "var(--color-secondary)",
                            flexShrink: 0,
                          }}
                        />
                        {rebuildResult}
                      </span>
                      <button
                        className="btn-icon"
                        onClick={() => setRebuildResult(null)}
                      >
                        <span className="icon" style={{ fontSize: "14px" }}>close</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── TAB 2: Engine Configuration (Read-only clean rows) ── */}
            {activeTab === "settings" && (
              <div
                style={{
                  background: "var(--color-background)",
                  border: "1px solid var(--color-outline-variant)",
                  borderRadius: "var(--radius-sm)",
                  padding: "1.25rem 1.5rem",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ marginBottom: "1rem" }}>
                  <h2 className="text-headline-sm" style={{ color: "var(--color-on-surface)" }}>
                    Engine Configuration
                  </h2>
                  <p className="text-body-sm" style={{ color: "var(--color-on-surface-variant)", marginTop: "2px" }}>
                    Read-only parameters of the active backend search engine and ranking pipeline.
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                  {[
                    {
                      label: "Ranking Algorithm",
                      desc: "Deterministic mathematical scoring heuristic for posting relevance",
                      value: "TF-IDF (Term Frequency–Inverse Document Frequency)",
                    },
                    {
                      label: "Case Sensitivity",
                      desc: "All tokens are lowercased prior to indexing",
                      value: "Disabled — lowercased stream",
                    },
                    {
                      label: "Stopword Filtering",
                      desc: "High-frequency common English words are removed from the index",
                      value: "Enabled",
                    },
                    {
                      label: "Accepted File Types",
                      desc: "Only plain-text files can be indexed",
                      value: ".txt (UTF-8 encoded)",
                    },
                    {
                      label: "Max File Size",
                      desc: "Files exceeding this limit are rejected at upload",
                      value: "5 MB",
                    },
                    {
                      label: "Search Semantics",
                      desc: "Documents matching any query term are returned, ranked by combined TF-IDF score",
                      value: "OR semantics with TF-IDF ranking",
                    },
                  ].map((row, i, arr) => (
                    <div
                      key={row.label}
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "var(--space-md)",
                        paddingTop: "1rem",
                        paddingBottom: "1rem",
                        borderBottom: i < arr.length - 1 ? "1px solid var(--color-outline-variant)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                        <span className="text-body-sm" style={{ color: "var(--color-on-surface)", fontWeight: 600 }}>
                          {row.label}
                        </span>
                        <span className="text-body-sm" style={{ color: "var(--color-on-surface-variant)", marginTop: "2px" }}>
                          {row.desc}
                        </span>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <span
                          className="text-mono-meta"
                          style={{
                            display: "inline-block",
                            padding: "4px 8px",
                            borderRadius: "var(--radius-xs)",
                            background: "var(--color-surface-container-low)",
                            border: "1px solid var(--color-outline-variant)",
                            color: "var(--color-on-surface)",
                          }}
                        >
                          {row.value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
