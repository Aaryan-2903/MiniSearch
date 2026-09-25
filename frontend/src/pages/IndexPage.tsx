/**
 * IndexPage.tsx
 * -------------
 * Two-tab view: "Inverted Index" (stats + rebuild) and "Settings" (read-only display
 * of actual backend capabilities — no fake toggles).
 */

import { useState } from "react";
import type { IndexStats } from "../lib/api";
import { api } from "../lib/api";
import { formatDate } from "../lib/utils";

interface IndexPageProps {
  stats: IndexStats | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function IndexPage({ stats, loading, error, onRefresh }: IndexPageProps) {
  const [activeTab, setActiveTab] = useState<"index" | "settings">("index");
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildResult, setRebuildResult] = useState<string | null>(null);

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
      {/* Page header with tabs */}
      <div
        style={{
          background: "var(--color-surface-container-low)",
          padding: "var(--space-lg) var(--space-xl) 0",
          borderBottom: "1px solid var(--color-outline-variant)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span className="text-mono-meta" style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-on-surface-variant)" }}>
              Engine Diagnostic
            </span>
            <h1 className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>
              Search Index &amp; Engine Settings
            </h1>
          </div>
          {stats && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 8px",
                borderRadius: "var(--radius-xs)",
                background: "var(--color-surface-container)",
                color: "var(--color-on-surface-variant)",
              }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: stats.index_status === "ready" ? "var(--color-secondary)" : "var(--color-outline)" }} />
              <span className="text-mono-meta">{stats.index_status === "ready" ? "Index ready" : stats.index_status}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)", marginTop: "var(--space-lg)" }}>
          <button className={`tab-btn${activeTab === "index" ? " active" : ""}`} onClick={() => setActiveTab("index")}>
            <span className="icon" style={{ fontSize: "16px" }}>account_tree</span>
            <span>Inverted Index</span>
          </button>
          <button className={`tab-btn${activeTab === "settings" ? " active" : ""}`} onClick={() => setActiveTab("settings")}>
            <span className="icon" style={{ fontSize: "16px" }}>tune</span>
            <span>Engine Settings</span>
          </button>
        </div>
      </div>

      <div style={{ padding: "var(--space-xl)", display: "flex", flexDirection: "column", gap: "var(--space-xl)", maxWidth: "1100px", width: "100%" }}>
        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <span className="icon spin" style={{ fontSize: "24px", color: "var(--color-on-surface-variant)" }}>refresh</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="error-state">
            <span className="icon" style={{ fontSize: "32px", color: "var(--color-error)" }}>error</span>
            <span className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>{error}</span>
            <button className="btn-ghost" onClick={onRefresh}>Retry</button>
          </div>
        )}

        {!loading && !error && stats && (
          <>
            {/* ── TAB 1: Inverted Index ── */}
            {activeTab === "index" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)" }}>
                {/* Stat cells */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-sm)" }}>
                  <div
                    style={{
                      padding: "var(--space-lg)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-outline-variant)",
                      background: "var(--color-surface-container-lowest)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <span className="text-label-sm" style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-outline)" }}>
                      Documents Indexed
                    </span>
                    <div style={{ marginTop: "var(--space-md)", display: "flex", alignItems: "baseline", gap: "var(--space-xs)" }}>
                      <span
                        style={{ fontFamily: "var(--font-mono)", fontSize: "1.75rem", fontWeight: 600, lineHeight: "2.25rem", color: "var(--color-on-surface)" }}
                      >
                        {stats.total_documents}
                      </span>
                      <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>.txt sources</span>
                    </div>
                    <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)", marginTop: "var(--space-xs)" }}>
                      {stats.total_documents > 0 ? "100% corpus ingested" : "No documents"}
                    </span>
                  </div>

                  <div
                    style={{
                      padding: "var(--space-lg)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-outline-variant)",
                      background: "var(--color-surface-container-lowest)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <span className="text-label-sm" style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-outline)" }}>
                      Unique Terms
                    </span>
                    <div style={{ marginTop: "var(--space-md)", display: "flex", alignItems: "baseline", gap: "var(--space-xs)" }}>
                      <span
                        style={{ fontFamily: "var(--font-mono)", fontSize: "1.75rem", fontWeight: 600, lineHeight: "2.25rem", color: "var(--color-on-surface)" }}
                      >
                        {stats.total_unique_terms.toLocaleString()}
                      </span>
                      <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>postings</span>
                    </div>
                    <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)", marginTop: "var(--space-xs)" }}>
                      {stats.total_documents > 0
                        ? `Avg ${Math.round(stats.total_unique_terms / stats.total_documents).toLocaleString()} terms / doc`
                        : "—"}
                    </span>
                  </div>

                  <div
                    style={{
                      padding: "var(--space-lg)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-outline-variant)",
                      background: "var(--color-surface-container-lowest)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <span className="text-label-sm" style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-outline)" }}>
                      Index Status
                    </span>
                    <div style={{ marginTop: "var(--space-md)", display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                      <span style={{
                        width: "8px", height: "8px", borderRadius: "50%",
                        background: stats.index_status === "ready" ? "var(--color-secondary)" : stats.index_status === "building" ? "var(--color-tertiary)" : "var(--color-outline)",
                      }} />
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "1.25rem",
                          fontWeight: 500,
                          color: stats.index_status === "ready" ? "var(--color-secondary)" : "var(--color-on-surface)",
                          textTransform: "capitalize",
                        }}
                      >
                        {stats.index_status}
                      </span>
                    </div>
                    <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)", marginTop: "var(--space-xs)" }}>
                      O(1) term lookup active
                    </span>
                  </div>

                  <div
                    style={{
                      padding: "var(--space-lg)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-outline-variant)",
                      background: "var(--color-surface-container-lowest)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <span className="text-label-sm" style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-outline)" }}>
                      Last Rebuilt
                    </span>
                    <div style={{ marginTop: "var(--space-md)" }}>
                      <span
                        style={{ fontFamily: "var(--font-mono)", fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-on-surface)" }}
                      >
                        {stats.last_built_at ? formatDate(stats.last_built_at) : "Never"}
                      </span>
                    </div>
                    <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)", marginTop: "var(--space-xs)" }}>
                      Synchronous rebuild
                    </span>
                  </div>
                </div>

                {/* Inverted index description */}
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)", background: "var(--color-surface-container-lowest)", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <h2 className="text-headline-sm" style={{ color: "var(--color-on-surface)" }}>Inverted index structure</h2>
                    <p className="text-body-sm" style={{ color: "var(--color-on-surface-variant)", marginTop: "2px" }}>
                      Maps tokenized terms directly to document IDs and posting frequency offsets for O(1) term lookup.
                      Tokens are preprocessed using lowercasing and stopword removal before insertion into the index.
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                    <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>Postings Table Format:</span>
                    <code
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.75rem",
                        background: "var(--color-surface-container)",
                        padding: "2px 6px",
                        borderRadius: "var(--radius-xs)",
                        color: "var(--color-on-surface)",
                      }}
                    >
                      DocID:Freq
                    </code>
                  </div>
                </div>

                {/* Rebuild section */}
                <div
                  style={{
                    padding: "var(--space-lg)",
                    background: "var(--color-surface-container-low)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-outline-variant)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-md)",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <h2 className="text-headline-sm" style={{ color: "var(--color-on-surface)" }}>Index Management</h2>
                    <p className="text-body-sm" style={{ color: "var(--color-on-surface-variant)" }}>
                      Rebuild the inverted index from scratch by reprocessing every document currently in the corpus.
                      Use this if the index is suspected to be inconsistent.
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                    <button
                      className="btn-primary"
                      onClick={handleRebuild}
                      disabled={rebuilding}
                      style={{ opacity: rebuilding ? 0.7 : 1, cursor: rebuilding ? "default" : "pointer" }}
                    >
                      <span className={`icon${rebuilding ? " spin" : ""}`} style={{ fontSize: "14px" }}>refresh</span>
                      <span>{rebuilding ? "Rebuilding..." : "Rebuild inverted index"}</span>
                    </button>
                  </div>

                  {rebuildResult && (
                    <div className="rebuild-banner">
                      <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: rebuildResult.startsWith("Error") ? "var(--color-error)" : "var(--color-secondary)", flexShrink: 0 }} />
                        {rebuildResult}
                      </span>
                      <button
                        className="btn-icon"
                        onClick={() => setRebuildResult(null)}
                      >
                        <span className="icon" style={{ fontSize: "12px" }}>close</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── TAB 2: Settings (read-only display of real config) ── */}
            {activeTab === "settings" && (
              <div
                style={{
                  background: "var(--color-surface-container-low)",
                  borderRadius: "var(--radius-sm)",
                  padding: "var(--space-lg)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-lg)",
                }}
              >
                <div>
                  <h2 className="text-headline-sm" style={{ color: "var(--color-on-surface)" }}>Engine Configuration</h2>
                  <p className="text-body-sm" style={{ color: "var(--color-on-surface-variant)", marginTop: "2px" }}>
                    Read-only view of the current backend processing configuration.
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
                        paddingTop: i === 0 ? 0 : "var(--space-md)",
                        paddingBottom: i === arr.length - 1 ? 0 : "var(--space-md)",
                        borderBottom: i < arr.length - 1 ? "1px solid color-mix(in srgb, var(--color-outline-variant) 30%, transparent)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                        <span className="text-label-md" style={{ color: "var(--color-on-surface)", fontWeight: 500 }}>{row.label}</span>
                        <span className="text-body-sm" style={{ color: "var(--color-on-surface-variant)", marginTop: "2px" }}>{row.desc}</span>
                      </div>
                      <div style={{ flexShrink: 0, maxWidth: "280px", textAlign: "right" }}>
                        <span
                          className="text-mono-meta"
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: "var(--radius-xs)",
                            background: "var(--color-surface-container)",
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

        {/* Empty state when no stats */}
        {!loading && !error && !stats && (
          <div className="empty-state">
            <span className="icon" style={{ fontSize: "32px", color: "var(--color-outline)" }}>database</span>
            <span className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>Index data unavailable.</span>
            <button className="btn-ghost" onClick={onRefresh}>Refresh</button>
          </div>
        )}
      </div>
    </div>
  );
}
