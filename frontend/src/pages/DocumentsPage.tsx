/**
 * DocumentsPage.tsx
 * -----------------
 * Document library: stat cells, filter/search bar, table with delete actions.
 * All data is fetched from the backend; no mock data.
 */

import { useState } from "react";
import type { DocFile } from "../lib/api";
import { api } from "../lib/api";
import { formatFileSize, formatDate } from "../lib/utils";

interface DocumentsPageProps {
  documents: DocFile[];
  loading: boolean;
  error: string | null;
  totalTerms: number;
  onAddDocuments: () => void;
  onRefresh: () => void;
  onViewDocument: (doc: DocFile) => void;
}

export function DocumentsPage({
  documents,
  loading,
  error,
  totalTerms,
  onAddDocuments,
  onRefresh,
  onViewDocument,
}: DocumentsPageProps) {
  const [filter, setFilter] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  const filtered = documents.filter((d) =>
    !filter || d.filename.toLowerCase().includes(filter.toLowerCase())
  );

  const totalSize = documents.reduce((s, d) => s + d.file_size, 0);

  async function handleDelete(doc: DocFile) {
    if (!confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return;
    setDeleting(doc.id);
    try {
      await api.deleteDocument(doc.id);
      onRefresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div style={{ padding: "var(--space-xl)", display: "flex", flexDirection: "column", gap: "var(--space-lg)", maxWidth: "1200px", width: "100%", margin: "0 auto" }}>
      {/* Page heading */}
      <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: "var(--space-md)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <h1 className="text-headline-lg" style={{ color: "var(--color-on-surface)", letterSpacing: "-0.02em" }}>Documents</h1>
          <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
            Manage your indexed text files and monitor inverted index health.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px var(--space-sm)",
            background: "var(--color-surface-container)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-secondary)" }} />
          <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>Cluster sync: 100%</span>
        </div>
      </div>

      {/* Stat cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-md)" }}>
        <div className="stat-cell">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--color-on-surface-variant)" }}>
            <span className="text-label-sm" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Total corpus</span>
            <span className="icon" style={{ fontSize: "16px" }}>folder</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-xs)" }}>
            <span className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>{documents.length}</span>
            <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>files</span>
          </div>
        </div>

        <div className="stat-cell">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--color-on-surface-variant)" }}>
            <span className="text-label-sm" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Indexed terms</span>
            <span className="icon" style={{ fontSize: "16px" }}>tag</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-xs)" }}>
            <span className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>{totalTerms.toLocaleString()}</span>
          </div>
        </div>

        <div className="stat-cell">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--color-on-surface-variant)" }}>
            <span className="text-label-sm" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Storage size</span>
            <span className="icon" style={{ fontSize: "16px" }}>database</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-xs)" }}>
            <span className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>{formatFileSize(totalSize)}</span>
          </div>
        </div>

        <div className="stat-cell">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--color-on-surface-variant)" }}>
            <span className="text-label-sm" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Avg terms/doc</span>
            <span className="icon" style={{ fontSize: "16px" }}>analytics</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-xs)" }}>
            <span className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>
              {documents.length ? Math.round(documents.reduce((s, d) => s + d.token_count, 0) / documents.length).toLocaleString() : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Filter bar + Add button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-md)", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1", maxWidth: "420px" }}>
          <span className="icon" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", fontSize: "18px", color: "var(--color-outline)", pointerEvents: "none" }}>search</span>
          <input
            type="text"
            placeholder="Filter documents by name..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              width: "100%",
              paddingLeft: "2.25rem",
              paddingRight: "var(--space-md)",
              paddingTop: "6px",
              paddingBottom: "6px",
              background: "var(--color-surface-container-low)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.8125rem",
              color: "var(--color-on-surface)",
              outline: "none",
              transition: "background 120ms",
            }}
            onFocus={(e) => (e.target.style.background = "var(--color-surface-container-lowest)")}
            onBlur={(e) => (e.target.style.background = "var(--color-surface-container-low)")}
          />
        </div>
        <button className="btn-primary" onClick={onAddDocuments}>
          <span className="icon" style={{ fontSize: "14px", fontWeight: 600 }}>add</span>
          <span>Add documents</span>
        </button>
      </div>

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

      {/* Table */}
      {!loading && !error && (
        <div style={{ background: "var(--color-surface-container-low)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Size</th>
                  <th>Terms</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <span className="icon" style={{ fontSize: "32px", color: "var(--color-outline)" }}>folder_open</span>
                        <span className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                          {filter ? `No documents matching "${filter}"` : "No documents yet. Upload some .txt files to get started."}
                        </span>
                        {!filter && (
                          <button className="btn-primary" onClick={onAddDocuments}>
                            <span className="icon" style={{ fontSize: "14px" }}>add</span>
                            Add documents
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((doc) => (
                    <tr key={doc.id} className="group">
                      <td>
                        <button
                          onClick={() => onViewDocument(doc)}
                          style={{ background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}
                        >
                          <span className="text-body-sm" style={{ color: "var(--color-on-surface)", fontWeight: 500, fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }}>
                            {doc.filename}
                          </span>
                        </button>
                      </td>
                      <td className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
                        {formatFileSize(doc.file_size)}
                      </td>
                      <td className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
                        {doc.token_count.toLocaleString()}
                      </td>
                      <td>
                        <span className="indexed-pill">
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-secondary)", flexShrink: 0 }} />
                          Indexed
                        </span>
                      </td>
                      <td className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
                        {formatDate(doc.uploaded_at)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}>
                          <button
                            className="btn-icon"
                            title="Open document"
                            onClick={() => onViewDocument(doc)}
                          >
                            <span className="icon" style={{ fontSize: "16px" }}>visibility</span>
                          </button>
                          <button
                            className="btn-icon danger"
                            title="Delete document"
                            onClick={() => handleDelete(doc)}
                            disabled={deleting === doc.id}
                          >
                            {deleting === doc.id ? (
                              <span className="icon spin" style={{ fontSize: "16px" }}>refresh</span>
                            ) : (
                              <span className="icon" style={{ fontSize: "16px" }}>delete</span>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div
              style={{
                padding: "var(--space-sm) var(--space-md)",
                background: "var(--color-surface-container-high)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
                Showing {filtered.length} of {documents.length} document{documents.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
