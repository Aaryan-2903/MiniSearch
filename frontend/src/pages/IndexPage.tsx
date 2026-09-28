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
import type { IndexStats, EngineSettings, EngineSettingsUpdate } from "../lib/api";
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

  const [settings, setSettings] = useState<EngineSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [maxFileSizeInput, setMaxFileSizeInput] = useState<string>("5");

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  async function loadSettings() {
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const res = await api.getSettings();
      setSettings(res);
      setMaxFileSizeInput(String(res.max_file_size_mb));
    } catch (e) {
      setSettingsError((e as Error).message);
    } finally {
      setSettingsLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

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
      await loadSettings();
    } catch (e) {
      setRebuildResult(`Error: ${(e as Error).message}`);
    } finally {
      setRebuilding(false);
    }
  }

  async function handleUpdateSetting(patch: EngineSettingsUpdate, fieldKey: string) {
    setSavingField(fieldKey);
    try {
      const updated = await api.updateSettings(patch);
      setSettings(updated);
      if (patch.max_file_size_mb !== undefined) {
        setMaxFileSizeInput(String(updated.max_file_size_mb));
      }
      onRefresh();
    } catch (e) {
      alert(`Failed to update setting: ${(e as Error).message}`);
    } finally {
      setSavingField(null);
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
                      <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>terms</span>
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

                  {settings?.rebuild_required && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "var(--color-surface-container)", borderRadius: "var(--radius-xs)" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-primary)", flexShrink: 0 }} />
                      <span className="text-body-sm" style={{ color: "var(--color-on-surface)", fontWeight: 500 }}>
                        Index rebuild required: Preprocessing settings have changed since the last index build.
                      </span>
                    </div>
                  )}

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

            {/* ── TAB 2: Engine Configuration (Editable settings controls) ── */}
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
                    Configure the active backend search engine and preprocessing pipeline parameters.
                  </p>
                </div>

                {/* Index Rebuild Required Banner */}
                {settings?.rebuild_required && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      marginBottom: "1rem",
                      borderRadius: "var(--radius-xs)",
                      background: "var(--color-surface-container-low)",
                      border: "1px solid var(--color-outline-variant)",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "var(--color-primary)",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span className="text-body-sm" style={{ color: "var(--color-on-surface)", fontWeight: 600 }}>
                          Index rebuild required
                        </span>
                        <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)", marginTop: "1px" }}>
                          Preprocessing settings have changed. Rebuild the index to apply changes to search.
                        </span>
                      </div>
                    </div>
                    <button
                      className="btn-primary"
                      onClick={handleRebuild}
                      disabled={rebuilding}
                      style={{ padding: "5px 12px", fontSize: "0.75rem", height: "auto" }}
                    >
                      <span className={`icon${rebuilding ? " spin" : ""}`} style={{ fontSize: "14px" }}>refresh</span>
                      <span>{rebuilding ? "Rebuilding..." : "Rebuild Index"}</span>
                    </button>
                  </div>
                )}

                {/* Rebuild result feedback banner if triggered from settings */}
                {rebuildResult && (
                  <div className="rebuild-banner" style={{ marginBottom: "1rem" }}>
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

                {settingsLoading && !settings && (
                  <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
                    <span className="icon spin" style={{ fontSize: "20px", color: "var(--color-on-surface-variant)" }}>refresh</span>
                  </div>
                )}

                {settingsError && (
                  <div style={{ padding: "10px", color: "var(--color-error)", fontSize: "0.875rem" }}>
                    Error loading settings: {settingsError}
                  </div>
                )}

                {settings && (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {/* 1. Case Sensitivity */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "var(--space-md)",
                        paddingTop: "1rem",
                        paddingBottom: "1rem",
                        borderBottom: "1px solid var(--color-outline-variant)",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                        <span className="text-body-sm" style={{ color: "var(--color-on-surface)", fontWeight: 600 }}>
                          Case Sensitivity
                        </span>
                        <span className="text-body-sm" style={{ color: "var(--color-on-surface-variant)", marginTop: "2px" }}>
                          Preserve token casing during preprocessing and search (requires index rebuild).
                        </span>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            background: "var(--color-surface-container-low)",
                            borderRadius: "var(--radius-xs)",
                            padding: "2px",
                            border: "1px solid var(--color-outline-variant)",
                          }}
                        >
                          <button
                            type="button"
                            id="case-sensitivity-off"
                            onClick={() => handleUpdateSetting({ case_sensitive: false }, "case_sensitive")}
                            disabled={savingField === "case_sensitive"}
                            style={{
                              background: !settings.case_sensitive ? "var(--color-surface-container-highest)" : "transparent",
                              color: !settings.case_sensitive ? "var(--color-on-surface)" : "var(--color-on-surface-variant)",
                              border: "none",
                              padding: "3px 10px",
                              borderRadius: "var(--radius-xs)",
                              fontSize: "0.75rem",
                              fontFamily: "var(--font-mono)",
                              fontWeight: !settings.case_sensitive ? 600 : 400,
                              cursor: "pointer",
                            }}
                          >
                            Off
                          </button>
                          <button
                            type="button"
                            id="case-sensitivity-on"
                            onClick={() => handleUpdateSetting({ case_sensitive: true }, "case_sensitive")}
                            disabled={savingField === "case_sensitive"}
                            style={{
                              background: settings.case_sensitive ? "var(--color-surface-container-highest)" : "transparent",
                              color: settings.case_sensitive ? "var(--color-on-surface)" : "var(--color-on-surface-variant)",
                              border: "none",
                              padding: "3px 10px",
                              borderRadius: "var(--radius-xs)",
                              fontSize: "0.75rem",
                              fontFamily: "var(--font-mono)",
                              fontWeight: settings.case_sensitive ? 600 : 400,
                              cursor: "pointer",
                            }}
                          >
                            On
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 2. Stopword Filtering */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "var(--space-md)",
                        paddingTop: "1rem",
                        paddingBottom: "1rem",
                        borderBottom: "1px solid var(--color-outline-variant)",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                        <span className="text-body-sm" style={{ color: "var(--color-on-surface)", fontWeight: 600 }}>
                          Stopword Filtering
                        </span>
                        <span className="text-body-sm" style={{ color: "var(--color-on-surface-variant)", marginTop: "2px" }}>
                          Filter high-frequency common English words from the index (requires index rebuild).
                        </span>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            background: "var(--color-surface-container-low)",
                            borderRadius: "var(--radius-xs)",
                            padding: "2px",
                            border: "1px solid var(--color-outline-variant)",
                          }}
                        >
                          <button
                            type="button"
                            id="stopword-filtering-on"
                            onClick={() => handleUpdateSetting({ stop_words_enabled: true }, "stop_words_enabled")}
                            disabled={savingField === "stop_words_enabled"}
                            style={{
                              background: settings.stop_words_enabled ? "var(--color-surface-container-highest)" : "transparent",
                              color: settings.stop_words_enabled ? "var(--color-on-surface)" : "var(--color-on-surface-variant)",
                              border: "none",
                              padding: "3px 10px",
                              borderRadius: "var(--radius-xs)",
                              fontSize: "0.75rem",
                              fontFamily: "var(--font-mono)",
                              fontWeight: settings.stop_words_enabled ? 600 : 400,
                              cursor: "pointer",
                            }}
                          >
                            On
                          </button>
                          <button
                            type="button"
                            id="stopword-filtering-off"
                            onClick={() => handleUpdateSetting({ stop_words_enabled: false }, "stop_words_enabled")}
                            disabled={savingField === "stop_words_enabled"}
                            style={{
                              background: !settings.stop_words_enabled ? "var(--color-surface-container-highest)" : "transparent",
                              color: !settings.stop_words_enabled ? "var(--color-on-surface)" : "var(--color-on-surface-variant)",
                              border: "none",
                              padding: "3px 10px",
                              borderRadius: "var(--radius-xs)",
                              fontSize: "0.75rem",
                              fontFamily: "var(--font-mono)",
                              fontWeight: !settings.stop_words_enabled ? 600 : 400,
                              cursor: "pointer",
                            }}
                          >
                            Off
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 3. Default Search Mode */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "var(--space-md)",
                        paddingTop: "1rem",
                        paddingBottom: "1rem",
                        borderBottom: "1px solid var(--color-outline-variant)",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                        <span className="text-body-sm" style={{ color: "var(--color-on-surface)", fontWeight: 600 }}>
                          Default Search Mode
                        </span>
                        <span className="text-body-sm" style={{ color: "var(--color-on-surface-variant)", marginTop: "2px" }}>
                          Controls default multi-term matching logic: Any (match at least one query term) or All (match every query term).
                        </span>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            background: "var(--color-surface-container-low)",
                            borderRadius: "var(--radius-xs)",
                            padding: "2px",
                            border: "1px solid var(--color-outline-variant)",
                          }}
                        >
                          <button
                            type="button"
                            id="search-mode-any"
                            onClick={() => handleUpdateSetting({ default_search_mode: "any" }, "default_search_mode")}
                            disabled={savingField === "default_search_mode"}
                            style={{
                              background: settings.default_search_mode === "any" ? "var(--color-surface-container-highest)" : "transparent",
                              color: settings.default_search_mode === "any" ? "var(--color-on-surface)" : "var(--color-on-surface-variant)",
                              border: "none",
                              padding: "3px 10px",
                              borderRadius: "var(--radius-xs)",
                              fontSize: "0.75rem",
                              fontFamily: "var(--font-mono)",
                              fontWeight: settings.default_search_mode === "any" ? 600 : 400,
                              cursor: "pointer",
                            }}
                          >
                            Any
                          </button>
                          <button
                            type="button"
                            id="search-mode-all"
                            onClick={() => handleUpdateSetting({ default_search_mode: "all" }, "default_search_mode")}
                            disabled={savingField === "default_search_mode"}
                            style={{
                              background: settings.default_search_mode === "all" ? "var(--color-surface-container-highest)" : "transparent",
                              color: settings.default_search_mode === "all" ? "var(--color-on-surface)" : "var(--color-on-surface-variant)",
                              border: "none",
                              padding: "3px 10px",
                              borderRadius: "var(--radius-xs)",
                              fontSize: "0.75rem",
                              fontFamily: "var(--font-mono)",
                              fontWeight: settings.default_search_mode === "all" ? 600 : 400,
                              cursor: "pointer",
                            }}
                          >
                            All
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 4. Max File Size */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "var(--space-md)",
                        paddingTop: "1rem",
                        paddingBottom: "1rem",
                        borderBottom: "1px solid var(--color-outline-variant)",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                        <span className="text-body-sm" style={{ color: "var(--color-on-surface)", fontWeight: 600 }}>
                          Max File Size
                        </span>
                        <span className="text-body-sm" style={{ color: "var(--color-on-surface-variant)", marginTop: "2px" }}>
                          Maximum upload size per file (1–50 MB). Files exceeding this limit are rejected at upload.
                        </span>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <input
                            type="number"
                            id="max-file-size-input"
                            min={1}
                            max={50}
                            value={maxFileSizeInput}
                            onChange={(e) => setMaxFileSizeInput(e.target.value)}
                            onBlur={() => {
                              const val = parseInt(maxFileSizeInput, 10);
                              if (!isNaN(val) && val >= 1 && val <= 50) {
                                if (val !== settings.max_file_size_mb) {
                                  handleUpdateSetting({ max_file_size_mb: val }, "max_file_size_mb");
                                }
                              } else {
                                setMaxFileSizeInput(String(settings.max_file_size_mb));
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.currentTarget.blur();
                              }
                            }}
                            style={{
                              width: "56px",
                              padding: "3px 8px",
                              borderRadius: "var(--radius-xs)",
                              background: "var(--color-surface-container-low)",
                              border: "1px solid var(--color-outline-variant)",
                              color: "var(--color-on-surface)",
                              fontFamily: "var(--font-mono)",
                              fontSize: "0.75rem",
                              textAlign: "right",
                            }}
                          />
                          <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>MB</span>
                        </div>
                      </div>
                    </div>

                    {/* 5. Ranking Algorithm (Read-only) */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "var(--space-md)",
                        paddingTop: "1rem",
                        paddingBottom: "1rem",
                        borderBottom: "1px solid var(--color-outline-variant)",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                        <span className="text-body-sm" style={{ color: "var(--color-on-surface)", fontWeight: 600 }}>
                          Ranking Algorithm
                        </span>
                        <span className="text-body-sm" style={{ color: "var(--color-on-surface-variant)", marginTop: "2px" }}>
                          Deterministic mathematical scoring heuristic for posting relevance.
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
                          {settings.ranking_algorithm} (Term Frequency–Inverse Document Frequency)
                        </span>
                      </div>
                    </div>

                    {/* 6. Accepted File Types (Read-only) */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "var(--space-md)",
                        paddingTop: "1rem",
                        paddingBottom: "1rem",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                        <span className="text-body-sm" style={{ color: "var(--color-on-surface)", fontWeight: 600 }}>
                          Accepted File Types
                        </span>
                        <span className="text-body-sm" style={{ color: "var(--color-on-surface-variant)", marginTop: "2px" }}>
                          Only plain-text files can be indexed.
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
                          {settings.accepted_file_types.join(", ")} (UTF-8 encoded)
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
