/**
 * DocumentViewPage.tsx
 * --------------------
 * Document reading workspace:
 * - Editorial typography with readable line-height and comfortable text width
 * - Path and document metadata
 * - Restrained actions (Download TXT/PDF, Delete) near document header
 * - Text-reading workspace (not a code editor)
 */

import type { DocFile, DocDetail } from "../lib/api";
import { api } from "../lib/api";
import { formatFileSize, formatDate } from "../lib/utils";
import { useState, useEffect } from "react";

interface DocumentViewPageProps {
  doc: DocFile;
  onBack: () => void;
  onDeleted: () => void;
}

export function DocumentViewPage({ doc, onBack, onDeleted }: DocumentViewPageProps) {
  const [deleting, setDeleting] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<"txt" | "pdf" | null>(null);
  const [detail, setDetail] = useState<DocDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const fullDoc = await api.getDocument(doc.id);
        setDetail(fullDoc);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [doc.id]);

  async function handleDownload(format: "txt" | "pdf") {
    setDownloadingFormat(format);
    try {
      await api.downloadAndSaveDocument(doc.id, format, doc.filename);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDownloadingFormat(null);
    }
  }

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

  const documentPath = doc.folder_name ? `${doc.folder_name} / ${doc.filename}` : doc.filename;

  return (
    <div style={{ padding: "2rem var(--space-xl)", maxWidth: "760px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Back button */}
      <button
        className="btn-ghost"
        onClick={onBack}
        style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: "6px" }}
      >
        <span className="icon" style={{ fontSize: "16px" }}>arrow_back</span>
        <span>Documents</span>
      </button>

      {/* Document header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-md)", flexWrap: "wrap", borderBottom: "1px solid var(--color-outline-variant)", paddingBottom: "1.25rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
          {/* Path hierarchy */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="icon" style={{ fontSize: "16px", color: "var(--color-primary)" }}>
              {doc.folder_name ? "folder" : "description"}
            </span>
            <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
              {documentPath}
            </span>
          </div>

          <h1 className="text-headline-md" style={{ color: "var(--color-on-surface)", fontWeight: 600 }}>
            {doc.filename}
          </h1>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "2px" }}>
            <span className="indexed-pill">
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-secondary)", flexShrink: 0 }} />
              Indexed
            </span>
            <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
              {formatFileSize(doc.file_size)} · {doc.token_count.toLocaleString()} tokens · Uploaded {formatDate(doc.uploaded_at)}
            </span>
          </div>
        </div>

        {/* Toolbar actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, marginTop: "4px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "var(--color-background)",
              border: "1px solid var(--color-outline-variant)",
              borderRadius: "var(--radius-sm)",
              overflow: "hidden",
            }}
          >
            <button
              className="btn-ghost"
              onClick={() => handleDownload("txt")}
              disabled={downloadingFormat !== null}
              style={{
                padding: "5px 10px",
                fontSize: "0.8125rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                border: "none",
                borderRadius: 0,
              }}
              title="Download as Text (.txt)"
            >
              <span className="icon" style={{ fontSize: "15px" }}>description</span>
              <span>Text (.txt)</span>
            </button>
            <div style={{ width: "1px", height: "16px", background: "var(--color-outline-variant)" }} />
            <button
              className="btn-ghost"
              onClick={() => handleDownload("pdf")}
              disabled={downloadingFormat !== null}
              style={{
                padding: "5px 10px",
                fontSize: "0.8125rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                border: "none",
                borderRadius: 0,
              }}
              title="Download as PDF (.pdf)"
            >
              <span className="icon" style={{ fontSize: "15px" }}>picture_as_pdf</span>
              <span>PDF (.pdf)</span>
            </button>
          </div>

          <button
            className="btn-danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <span className="icon spin" style={{ fontSize: "14px" }}>refresh</span>
            ) : (
              <span className="icon" style={{ fontSize: "14px" }}>delete</span>
            )}
            <span>{deleting ? "Deleting..." : "Delete"}</span>
          </button>
        </div>
      </div>

      {/* Document Content Workspace */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="text-label-sm" style={{ color: "var(--color-on-surface-variant)" }}>
            Document Body
          </span>
          <span className="text-mono-meta" style={{ color: "var(--color-outline)" }}>
            UTF-8 Text
          </span>
        </div>

        {loading ? (
          <div style={{ padding: "var(--space-xl)", textAlign: "center", color: "var(--color-outline)" }}>
            <span className="icon spin" style={{ fontSize: "20px" }}>refresh</span>
            <div className="text-body-sm" style={{ marginTop: "6px" }}>Loading content...</div>
          </div>
        ) : error ? (
          <div style={{ padding: "var(--space-md)", color: "var(--color-error)", background: "var(--color-error-container)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-error)" }}>
            Error loading content: {error}
          </div>
        ) : detail ? (
          <div
            style={{
              background: "var(--color-background)",
              padding: "1.5rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-outline-variant)",
              fontSize: "0.9375rem",
              lineHeight: 1.65,
              color: "var(--color-on-surface)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: "650px",
              overflowY: "auto",
            }}
          >
            {detail.content}
          </div>
        ) : null}
      </div>
    </div>
  );
}
