/**
 * DocumentViewPage.tsx
 * --------------------
 * Simple document detail view: shows metadata and the ability to delete.
 * Accessible from Search results or Documents table.
 */

import type { DocFile } from "../lib/api";
import { api } from "../lib/api";
import { formatFileSize, formatDate } from "../lib/utils";
import { useState } from "react";

interface DocumentViewPageProps {
  doc: DocFile;
  onBack: () => void;
  onDeleted: () => void;
}

export function DocumentViewPage({ doc, onBack, onDeleted }: DocumentViewPageProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.deleteDocument(doc.id);
      onDeleted();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ padding: "var(--space-xl)", maxWidth: "760px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-xl)" }}>
      {/* Back button */}
      <button
        className="btn-ghost"
        onClick={onBack}
        style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "4px" }}
      >
        <span className="icon" style={{ fontSize: "16px" }}>arrow_back</span>
        Back
      </button>

      {/* Document header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-md)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <span className="icon" style={{ fontSize: "20px", color: "var(--color-primary)" }}>description</span>
            <h1 className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>
              {doc.filename}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingLeft: "28px" }}>
            <span className="indexed-pill">
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-secondary)", flexShrink: 0 }} />
              Indexed
            </span>
          </div>
        </div>
        <button
          className="btn-danger"
          onClick={handleDelete}
          disabled={deleting}
          style={{ flexShrink: 0 }}
        >
          {deleting ? (
            <span className="icon spin" style={{ fontSize: "14px" }}>refresh</span>
          ) : (
            <span className="icon" style={{ fontSize: "14px" }}>delete</span>
          )}
          <span>{deleting ? "Deleting..." : "Delete"}</span>
        </button>
      </div>

      {/* Metadata grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-md)" }}>
        {[
          { label: "Document ID", value: `#${doc.id}` },
          { label: "File Size", value: formatFileSize(doc.file_size) },
          { label: "Token Count", value: doc.token_count.toLocaleString() },
          { label: "Uploaded", value: formatDate(doc.uploaded_at) },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              background: "var(--color-surface-container-low)",
              borderRadius: "var(--radius-sm)",
              padding: "var(--space-md)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <span className="text-label-sm" style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-outline)" }}>
              {item.label}
            </span>
            <span
              className="text-mono-meta"
              style={{ color: "var(--color-on-surface)", fontWeight: 500, fontSize: "0.875rem" }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* Info note */}
      <div
        style={{
          background: "var(--color-surface-container-low)",
          borderRadius: "var(--radius-sm)",
          padding: "var(--space-md)",
          display: "flex",
          alignItems: "flex-start",
          gap: "var(--space-sm)",
        }}
      >
        <span className="icon" style={{ fontSize: "16px", color: "var(--color-outline)", flexShrink: 0, marginTop: "2px" }}>info</span>
        <span className="text-body-sm" style={{ color: "var(--color-on-surface-variant)" }}>
          Document content is stored on disk. The inverted index maps tokenised terms from this file
          to their positions for fast TF-IDF ranked retrieval. Deleting this document also removes its
          postings from the index.
        </span>
      </div>
    </div>
  );
}
