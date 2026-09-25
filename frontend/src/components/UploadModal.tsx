/**
 * UploadModal.tsx
 * ---------------
 * Modal for selecting and uploading .txt files.
 * Supports file-picker and drag-and-drop.
 * Validates file type client-side before uploading.
 * Shows per-file upload states; refreshes parent on success.
 */

import { useRef, useState, useCallback, DragEvent } from "react";
import { api } from "../lib/api";
import { formatFileSize } from "../lib/utils";

interface StagedFile {
  file: File;
  status: "ready" | "uploading" | "done" | "error";
  error?: string;
}

interface UploadModalProps {
  onClose: () => void;
  onUploaded: () => void;
}

export function UploadModal({ onClose, onUploaded }: UploadModalProps) {
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const valid: StagedFile[] = [];
    const rejected: string[] = [];

    for (const f of arr) {
      if (!f.name.toLowerCase().endsWith(".txt")) {
        rejected.push(f.name);
      } else if (staged.some((s) => s.file.name === f.name && s.file.size === f.size)) {
        // silently skip duplicates
      } else {
        valid.push({ file: f, status: "ready" });
      }
    }

    if (rejected.length) {
      // show inline error in modal by prepending a fake entry — clean approach
      // We simply alert; no UI anti-patterns needed.
      alert(`Rejected (not .txt): ${rejected.join(", ")}`);
    }

    setStaged((prev) => [...prev, ...valid]);
  }

  function removeStaged(index: number) {
    setStaged((prev) => prev.filter((_, i) => i !== index));
  }

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
    },
    [staged]
  );

  async function handleUpload() {
    if (!staged.length || uploading) return;
    setUploading(true);

    const results = await Promise.allSettled(
      staged.map(async (s, i) => {
        setStaged((prev) =>
          prev.map((x, xi) => (xi === i ? { ...x, status: "uploading" } : x))
        );
        await api.uploadDocument(s.file);
        setStaged((prev) =>
          prev.map((x, xi) => (xi === i ? { ...x, status: "done" } : x))
        );
      })
    );

    // Mark errors
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        setStaged((prev) =>
          prev.map((x, xi) =>
            xi === i
              ? { ...x, status: "error", error: (r.reason as Error)?.message ?? "Upload failed" }
              : x
          )
        );
      }
    });

    setUploading(false);
    const anySuccess = results.some((r) => r.status === "fulfilled");
    if (anySuccess) {
      onUploaded();
      // Close after a brief moment so user sees the "done" state
      setTimeout(onClose, 600);
    }
  }

  const readyCount = staged.filter((s) => s.status === "ready").length;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <div className="modal-header">
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <h2 className="text-headline-sm" style={{ color: "var(--color-on-surface)" }}>
              Add documents
            </h2>
            <p className="text-body-sm" style={{ color: "var(--color-on-surface-variant)" }}>
              Upload .txt files to add them to your searchable library.
            </p>
          </div>
          <button
            className="btn-icon"
            onClick={onClose}
            title="Close"
            style={{ marginTop: "-2px" }}
          >
            <span className="icon" style={{ fontSize: "20px" }}>close</span>
          </button>
        </div>

        <div className="modal-body">
          {/* Drop zone */}
          <div
            className={`drop-zone${dragging ? " dragging" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "var(--color-surface-container-lowest)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "var(--space-sm)",
              }}
            >
              <span className="icon" style={{ fontSize: "20px", color: "var(--color-on-surface-variant)" }}>upload_file</span>
            </div>
            <span className="text-body-sm" style={{ fontWeight: 500, color: "var(--color-on-surface)" }}>
              Drop .txt files here or{" "}
              <span style={{ color: "var(--color-primary)" }}>choose files</span>
            </span>
            <span className="text-mono-meta" style={{ color: "var(--color-outline)", marginTop: "4px" }}>
              Only .txt files are currently supported (UTF-8 encoded)
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".txt,text/plain"
              multiple
              style={{ display: "none" }}
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </div>

          {/* Staged file list */}
          {staged.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
              <span
                className="text-label-sm"
                style={{
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--color-on-surface-variant)",
                }}
              >
                Staged files ({staged.length})
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {staged.map((s, i) => (
                  <div key={i} className="upload-file-row">
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", minWidth: 0 }}>
                      <span className="icon" style={{ fontSize: "16px", color: "var(--color-outline)", flexShrink: 0 }}>description</span>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-xs)", minWidth: 0, overflow: "hidden" }}>
                        <span
                          className="text-mono-code"
                          style={{ color: "var(--color-on-surface)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {s.file.name}
                        </span>
                        <span className="text-mono-meta" style={{ color: "var(--color-outline)", flexShrink: 0 }}>
                          {formatFileSize(s.file.size)}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexShrink: 0 }}>
                      {s.status === "ready" && (
                        <span
                          className="text-mono-meta"
                          style={{
                            padding: "2px 8px",
                            borderRadius: "var(--radius-xs)",
                            background: "color-mix(in srgb, var(--color-secondary-container) 50%, transparent)",
                            color: "var(--color-on-secondary-container)",
                          }}
                        >
                          Ready
                        </span>
                      )}
                      {s.status === "uploading" && (
                        <span className="icon spin" style={{ fontSize: "16px", color: "var(--color-primary)" }}>refresh</span>
                      )}
                      {s.status === "done" && (
                        <span className="icon" style={{ fontSize: "16px", color: "var(--color-secondary)" }}>check_circle</span>
                      )}
                      {s.status === "error" && (
                        <span
                          className="text-mono-meta"
                          style={{ color: "var(--color-error)", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          title={s.error}
                        >
                          {s.error}
                        </span>
                      )}
                      {s.status === "ready" && (
                        <button className="btn-icon danger" onClick={() => removeStaged(i)} title="Remove">
                          <span className="icon" style={{ fontSize: "14px" }}>close</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pipeline preview */}
          {staged.length > 0 && (
            <div
              style={{
                background: "var(--color-surface-container)",
                borderRadius: "var(--radius-xs)",
                padding: "var(--space-sm) var(--space-md)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-xs)" }}>
                <span className="text-mono-meta" style={{ textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, color: "var(--color-on-surface-variant)" }}>
                  Indexing pipeline
                </span>
                <span className="text-mono-meta" style={{ color: "var(--color-secondary)", fontWeight: 500 }}>
                  Zero errors
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", overflowX: "auto" }}>
                {["Text parsed", "Tokens extracted", "Building inverted index", "Ready to index"].map((step, i, arr) => (
                  <span key={step} style={{ display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
                    <span className="icon" style={{ fontSize: "12px", color: "var(--color-secondary)" }}>check</span>
                    <span className="text-mono-meta" style={{ color: i === arr.length - 1 ? "var(--color-primary)" : "var(--color-secondary)", fontWeight: i === arr.length - 1 ? 600 : 400 }}>
                      {step}
                    </span>
                    {i < arr.length - 1 && (
                      <span className="text-mono-meta" style={{ color: "var(--color-outline)", marginLeft: "4px" }}>→</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={handleUpload}
            disabled={readyCount === 0 || uploading}
            style={{ opacity: readyCount === 0 || uploading ? 0.6 : 1, cursor: readyCount === 0 || uploading ? "default" : "pointer" }}
          >
            {uploading ? (
              <>
                <span className="icon spin" style={{ fontSize: "14px" }}>refresh</span>
                <span>Indexing...</span>
              </>
            ) : (
              <span>Add to library{readyCount > 0 ? ` (${readyCount} file${readyCount > 1 ? "s" : ""})` : ""}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
