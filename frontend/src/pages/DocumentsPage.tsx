/**
 * DocumentsPage.tsx
 * -----------------
 * File manager and document library:
 * - One level of folders (DSA, PCQ, Notes, etc.)
 * - Folder count and root documents display
 * - Inside folder navigation with breadcrumb
 * - Folder actions: + New Folder, Rename, Delete (moves docs to root)
 * - Document actions menu: Open, Rename, Move, Copy, Delete
 * - Move / Copy destination selector (○ Root, ○ Folder...)
 * - Preserves Stitch visual language and warm neutral aesthetic
 */

import { useState } from "react";
import type { DocFile, Folder } from "../lib/api";
import { api } from "../lib/api";
import { formatFileSize, formatDate } from "../lib/utils";

interface DocumentsPageProps {
  documents: DocFile[];
  folders: Folder[];
  loading: boolean;
  error: string | null;
  totalTerms: number;
  onAddDocuments: (folderId?: number | null) => void;
  onRefresh: () => void;
  onViewDocument: (doc: DocFile) => void;
}

export function DocumentsPage({
  documents,
  folders,
  loading,
  error,
  totalTerms,
  onAddDocuments,
  onRefresh,
  onViewDocument,
}: DocumentsPageProps) {
  // Navigation: null = Root / All Documents; number = folder ID
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [filter, setFilter] = useState("");
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);
  const [activeMenuDocId, setActiveMenuDocId] = useState<number | null>(null);
  const [menuOpenUpward, setMenuOpenUpward] = useState(false);
  const [openDownloadSubmenuDocId, setOpenDownloadSubmenuDocId] = useState<number | null>(null);

  // Folder modal state
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderActionError, setFolderActionError] = useState<string | null>(null);

  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);
  const [renamedFolderName, setRenamedFolderName] = useState("");

  // Document modal state
  const [moveDoc, setMoveDoc] = useState<DocFile | null>(null);
  const [copyDoc, setCopyDoc] = useState<DocFile | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<number | null>(null);
  const [destModalError, setDestModalError] = useState<string | null>(null);

  const [renamingDoc, setRenamingDoc] = useState<DocFile | null>(null);
  const [newDocFilename, setNewDocFilename] = useState("");
  const [renameDocError, setRenameDocError] = useState<string | null>(null);

  // Confirmation dialogs
  const [docToDelete, setDocToDelete] = useState<DocFile | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);

  const [actionInProgress, setActionInProgress] = useState(false);

  // Current folder object (if inside a folder)
  const currentFolder = folders.find((f) => f.id === currentFolderId) ?? null;

  // Filtered documents:
  // If in root (currentFolderId === null): show documents where folder_id is null
  // If in folder (currentFolderId !== null): show documents where folder_id === currentFolderId
  const displayedDocs = documents.filter((d) => {
    const matchesFolder =
      currentFolderId === null ? d.folder_id === null || d.folder_id === undefined : d.folder_id === currentFolderId;
    const matchesFilter = !filter || d.filename.toLowerCase().includes(filter.toLowerCase());
    return matchesFolder && matchesFilter;
  });

  const totalSize = documents.reduce((s, d) => s + d.file_size, 0);

  // ── Document Operations ──────────────────────────────────────────────────────

  function handleDeleteDoc(doc: DocFile) {
    setActiveMenuDocId(null);
    setDocToDelete(doc);
  }

  function handleOpenMoveModal(doc: DocFile) {
    setActiveMenuDocId(null);
    setMoveDoc(doc);
    setTargetFolderId(doc.folder_id ?? null);
    setDestModalError(null);
  }

  function handleOpenCopyModal(doc: DocFile) {
    setActiveMenuDocId(null);
    setCopyDoc(doc);
    setTargetFolderId(doc.folder_id ?? null);
    setDestModalError(null);
  }

  function handleOpenRenameDocModal(doc: DocFile) {
    setActiveMenuDocId(null);
    setRenamingDoc(doc);
    setNewDocFilename(doc.filename);
    setRenameDocError(null);
  }

  function handleToggleMenu(e: React.MouseEvent<HTMLButtonElement>, docId: number) {
    e.stopPropagation();
    if (activeMenuDocId === docId) {
      setActiveMenuDocId(null);
      return;
    }
    const buttonRect = e.currentTarget.getBoundingClientRect();
    const spaceBelowViewport = window.innerHeight - buttonRect.bottom;
    const spaceAboveViewport = buttonRect.top;

    const tableContainer = e.currentTarget.closest(".doc-table-container");
    const containerRect = tableContainer?.getBoundingClientRect();
    const spaceBelowContainer = containerRect ? containerRect.bottom - buttonRect.bottom : Infinity;

    // Open upward if near bottom of viewport (< 210px) or near bottom of table container (< 80px),
    // provided there is enough space above
    const openUpward = (spaceBelowViewport < 210 || spaceBelowContainer < 80) && spaceAboveViewport > 180;
    setMenuOpenUpward(openUpward);
    setOpenDownloadSubmenuDocId(null);
    setActiveMenuDocId(docId);
  }

  async function handleDownloadDoc(doc: DocFile, format: "txt" | "pdf") {
    setActiveMenuDocId(null);
    setOpenDownloadSubmenuDocId(null);
    try {
      await api.downloadAndSaveDocument(doc.id, format, doc.filename);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function handleConfirmMove() {
    if (!moveDoc) return;
    setActionInProgress(true);
    setDestModalError(null);
    try {
      await api.updateDocument(moveDoc.id, { folder_id: targetFolderId });
      setMoveDoc(null);
      onRefresh();
    } catch (e) {
      setDestModalError((e as Error).message);
    } finally {
      setActionInProgress(false);
    }
  }

  async function handleConfirmCopy() {
    if (!copyDoc) return;
    setActionInProgress(true);
    setDestModalError(null);
    try {
      await api.copyDocument(copyDoc.id, targetFolderId);
      setCopyDoc(null);
      onRefresh();
    } catch (e) {
      setDestModalError((e as Error).message);
    } finally {
      setActionInProgress(false);
    }
  }

  async function handleConfirmRenameDoc() {
    if (!renamingDoc) return;
    const trimmed = newDocFilename.trim();
    if (!trimmed) {
      setRenameDocError("Filename cannot be empty.");
      return;
    }
    if (!trimmed.toLowerCase().endsWith(".txt")) {
      setRenameDocError("Filename must end with .txt");
      return;
    }
    setActionInProgress(true);
    setRenameDocError(null);
    try {
      await api.updateDocument(renamingDoc.id, { filename: trimmed });
      setRenamingDoc(null);
      onRefresh();
    } catch (e) {
      setRenameDocError((e as Error).message);
    } finally {
      setActionInProgress(false);
    }
  }

  // ── Folder Operations ────────────────────────────────────────────────────────

  async function handleCreateFolder() {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setFolderActionError("Folder name cannot be empty.");
      return;
    }
    setActionInProgress(true);
    setFolderActionError(null);
    try {
      await api.createFolder(trimmed);
      setNewFolderName("");
      setShowNewFolderModal(false);
      onRefresh();
    } catch (e) {
      setFolderActionError((e as Error).message);
    } finally {
      setActionInProgress(false);
    }
  }

  async function handleConfirmRenameFolder() {
    if (!renamingFolder) return;
    const trimmed = renamedFolderName.trim();
    if (!trimmed) {
      setFolderActionError("Folder name cannot be empty.");
      return;
    }
    setActionInProgress(true);
    setFolderActionError(null);
    try {
      await api.renameFolder(renamingFolder.id, trimmed);
      setRenamingFolder(null);
      onRefresh();
    } catch (e) {
      setFolderActionError((e as Error).message);
    } finally {
      setActionInProgress(false);
    }
  }

  function handleDeleteFolder(folder: Folder) {
    setFolderToDelete(folder);
  }

  return (
    <div
      style={{
        padding: "var(--space-xl)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-lg)",
        maxWidth: "1200px",
        width: "100%",
        margin: "0 auto",
      }}
      onClick={() => {
        if (activeMenuDocId !== null) setActiveMenuDocId(null);
        if (openDownloadSubmenuDocId !== null) setOpenDownloadSubmenuDocId(null);
      }}
    >
      {/* Page / Folder Navigation Header */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "var(--space-md)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {currentFolderId === null ? (
            <>
              <h1 className="text-headline-lg" style={{ color: "var(--color-on-surface)", letterSpacing: "-0.02em" }}>
                Documents
              </h1>
              <p className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                Organize your documents manually into folders and monitor inverted index health.
              </p>
            </>
          ) : (
            <>
              {/* Folder Breadcrumb */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  className="btn-ghost"
                  onClick={() => setCurrentFolderId(null)}
                  style={{ padding: "3px 8px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                >
                  <span className="icon" style={{ fontSize: "14px" }}>arrow_back</span>
                  <span>All Documents</span>
                </button>
                <span className="text-mono-meta" style={{ color: "color-mix(in srgb, var(--color-on-surface-variant) 40%, transparent)" }}>/</span>
                <span className="text-mono-meta" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                  {currentFolder?.name ?? "Folder"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginTop: "4px" }}>
                <h1 className="text-headline-lg" style={{ color: "var(--color-on-surface)", letterSpacing: "-0.02em" }}>
                  {currentFolder?.name}
                </h1>
                <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
                  {displayedDocs.length} document{displayedDocs.length !== 1 ? "s" : ""}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {currentFolderId === null ? (
            <>
              <button
                className="btn-ghost"
                onClick={() => {
                  setNewFolderName("");
                  setFolderActionError(null);
                  setShowNewFolderModal(true);
                }}
              >
                <span className="icon" style={{ fontSize: "16px" }}>create_new_folder</span>
                <span>+ New Folder</span>
              </button>
              <button className="btn-primary" onClick={() => onAddDocuments(null)}>
                <span className="icon" style={{ fontSize: "14px", fontWeight: 600 }}>add</span>
                <span>Add documents</span>
              </button>
            </>
          ) : (
            <>
              {currentFolder && (
                <>
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      setRenamingFolder(currentFolder);
                      setRenamedFolderName(currentFolder.name);
                      setFolderActionError(null);
                    }}
                  >
                    <span className="icon" style={{ fontSize: "16px" }}>edit</span>
                    <span>Rename folder</span>
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => handleDeleteFolder(currentFolder)}
                  >
                    <span className="icon" style={{ fontSize: "16px" }}>delete</span>
                    <span>Delete folder</span>
                  </button>
                </>
              )}
              <button className="btn-primary" onClick={() => onAddDocuments(currentFolderId)}>
                <span className="icon" style={{ fontSize: "14px", fontWeight: 600 }}>add</span>
                <span>Add files</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stat cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-md)" }}>
        <div className="stat-cell">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--color-on-surface-variant)" }}>
            <span className="text-label-sm" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Total corpus</span>
            <span className="icon" style={{ fontSize: "16px" }}>description</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-xs)" }}>
            <span className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>{documents.length}</span>
            <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>files</span>
          </div>
        </div>

        <div className="stat-cell">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--color-on-surface-variant)" }}>
            <span className="text-label-sm" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Folders</span>
            <span className="icon" style={{ fontSize: "16px" }}>folder</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-xs)" }}>
            <span className="text-headline-md" style={{ color: "var(--color-on-surface)" }}>{folders.length}</span>
            <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>folders</span>
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
      </div>

      {/* Folders Section (Only in Root view) */}
      {currentFolderId === null && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px" }}>
            <span className="text-label-sm" style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-on-surface-variant)", fontWeight: 600 }}>
              Folders ({folders.length})
            </span>
          </div>

          {folders.length === 0 ? (
            <div
              style={{
                padding: "var(--space-md)",
                background: "var(--color-surface-container-low)",
                borderRadius: "var(--radius-sm)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span className="text-body-sm" style={{ color: "var(--color-on-surface-variant)" }}>
                No folders yet. Click <strong>+ New Folder</strong> to organize your documents.
              </span>
            </div>
          ) : (
            <div className="folder-grid">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="folder-card"
                  onClick={() => setCurrentFolderId(folder.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <span className="icon" style={{ fontSize: "22px", color: "var(--color-primary)", flexShrink: 0 }}>folder</span>
                      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <span
                          className="text-body-sm"
                          style={{
                            fontWeight: 600,
                            color: "var(--color-on-surface)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {folder.name}
                        </span>
                        <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
                          {folder.document_count} document{folder.document_count !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    {/* Folder Context Actions */}
                    <div
                      style={{ display: "flex", alignItems: "center", gap: "2px" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="btn-icon"
                        title="Rename folder"
                        onClick={() => {
                          setRenamingFolder(folder);
                          setRenamedFolderName(folder.name);
                          setFolderActionError(null);
                        }}
                      >
                        <span className="icon" style={{ fontSize: "15px" }}>edit</span>
                      </button>
                      <button
                        className="btn-icon danger"
                        title="Delete folder"
                        onClick={() => handleDeleteFolder(folder)}
                      >
                        <span className="icon" style={{ fontSize: "15px" }}>delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-md)", flexWrap: "wrap", marginTop: "var(--space-xs)" }}>
        <div style={{ position: "relative", flex: "1", maxWidth: "420px" }}>
          <span
            className="icon"
            style={{
              position: "absolute",
              left: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "18px",
              color: "var(--color-outline)",
              pointerEvents: "none",
            }}
          >
            search
          </span>
          <input
            type="text"
            placeholder={currentFolderId === null ? "Filter root documents..." : `Filter documents in ${currentFolder?.name}...`}
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

        <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
          {currentFolderId === null ? "Root Documents" : `${currentFolder?.name} Documents`} ({displayedDocs.length})
        </span>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <span className="icon spin" style={{ fontSize: "24px", color: "var(--color-on-surface-variant)" }}>
            refresh
          </span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="error-state">
          <span className="icon" style={{ fontSize: "32px", color: "var(--color-error)" }}>error</span>
          <span className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>{error}</span>
          <button className="btn-ghost" onClick={onRefresh}>Retry</button>
        </div>
      )}

      {/* Documents Table */}
      {!loading && !error && (
        <div className="doc-table-container" style={{ background: "var(--color-surface-container-low)", borderRadius: "var(--radius-md)", overflow: "visible" }}>
          <div style={{ overflow: "visible" }}>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Folder</th>
                  <th>Size</th>
                  <th>Terms</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedDocs.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <span className="icon" style={{ fontSize: "32px", color: "var(--color-outline)" }}>
                          folder_open
                        </span>
                        <span className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
                          {filter
                            ? `No documents matching "${filter}"`
                            : currentFolderId === null
                            ? "No root-level documents. Upload some or move documents to Root."
                            : `Folder "${currentFolder?.name}" is currently empty.`}
                        </span>
                        {!filter && (
                          <button
                            className="btn-primary"
                            onClick={() => onAddDocuments(currentFolderId)}
                          >
                            <span className="icon" style={{ fontSize: "14px" }}>add</span>
                            Add documents
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedDocs.map((doc) => (
                    <tr key={doc.id} className="group">
                      <td>
                        <button
                          onClick={() => onViewDocument(doc)}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            textAlign: "left",
                            padding: 0,
                          }}
                        >
                          <span
                            className="text-body-sm"
                            style={{
                              color: "var(--color-on-surface)",
                              fontWeight: 500,
                              fontFamily: "var(--font-mono)",
                              fontSize: "0.8125rem",
                            }}
                          >
                            {doc.filename}
                          </span>
                        </button>
                      </td>
                      <td>
                        {doc.folder_name ? (
                          <span
                            className="text-mono-meta"
                            style={{
                              color: "var(--color-primary)",
                              fontWeight: 500,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            <span className="icon" style={{ fontSize: "13px" }}>folder</span>
                            {doc.folder_name}
                          </span>
                        ) : (
                          <span className="text-mono-meta" style={{ color: "var(--color-outline)" }}>
                            Root
                          </span>
                        )}
                      </td>
                      <td className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
                        {formatFileSize(doc.file_size)}
                      </td>
                      <td className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
                        {doc.token_count.toLocaleString()}
                      </td>
                      <td>
                        <span className="indexed-pill">
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              background: "var(--color-secondary)",
                              flexShrink: 0,
                            }}
                          />
                          Indexed
                        </span>
                      </td>
                      <td className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
                        {formatDate(doc.uploaded_at)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div
                          style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="btn-icon"
                            title="Open document"
                            onClick={() => onViewDocument(doc)}
                          >
                            <span className="icon" style={{ fontSize: "16px" }}>visibility</span>
                          </button>

                          {/* Unobtrusive Action Menu Dropdown */}
                          <div className={`action-menu-container ${activeMenuDocId === doc.id ? "active" : ""}`}>
                            <button
                              className="btn-icon"
                              title="Document actions"
                              onClick={(e) => handleToggleMenu(e, doc.id)}
                            >
                              <span className="icon" style={{ fontSize: "16px" }}>more_vert</span>
                            </button>

                            {activeMenuDocId === doc.id && (
                              <div className={`action-menu-dropdown ${menuOpenUpward ? "open-upward" : ""}`}>
                                <button
                                  className="action-menu-item"
                                  onClick={() => {
                                    setActiveMenuDocId(null);
                                    onViewDocument(doc);
                                  }}
                                >
                                  <span className="icon" style={{ fontSize: "15px" }}>visibility</span>
                                  <span>Open</span>
                                </button>
                                <button
                                  className="action-menu-item"
                                  onClick={() => handleOpenRenameDocModal(doc)}
                                >
                                  <span className="icon" style={{ fontSize: "15px" }}>edit</span>
                                  <span>Rename</span>
                                </button>
                                <div
                                  className={`action-menu-submenu-wrapper ${openDownloadSubmenuDocId === doc.id ? "open" : ""}`}
                                  onMouseEnter={() => setOpenDownloadSubmenuDocId(doc.id)}
                                  onMouseLeave={() => setOpenDownloadSubmenuDocId(null)}
                                >
                                  <button
                                    className="action-menu-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenDownloadSubmenuDocId(openDownloadSubmenuDocId === doc.id ? null : doc.id);
                                    }}
                                  >
                                    <span className="icon" style={{ fontSize: "15px" }}>download</span>
                                    <span style={{ flex: 1 }}>Download</span>
                                    <span className="icon" style={{ fontSize: "14px", color: "var(--color-outline)" }}>chevron_left</span>
                                  </button>
                                  <div className="action-menu-submenu">
                                    <button
                                      className="action-menu-item"
                                      onClick={() => handleDownloadDoc(doc, "txt")}
                                    >
                                      <span className="icon" style={{ fontSize: "15px" }}>description</span>
                                      <span>Text (.txt)</span>
                                    </button>
                                    <button
                                      className="action-menu-item"
                                      onClick={() => handleDownloadDoc(doc, "pdf")}
                                    >
                                      <span className="icon" style={{ fontSize: "15px" }}>picture_as_pdf</span>
                                      <span>PDF (.pdf)</span>
                                    </button>
                                  </div>
                                </div>
                                <button
                                  className="action-menu-item"
                                  onClick={() => handleOpenMoveModal(doc)}
                                >
                                  <span className="icon" style={{ fontSize: "15px" }}>drive_file_move</span>
                                  <span>Move</span>
                                </button>
                                <button
                                  className="action-menu-item"
                                  onClick={() => handleOpenCopyModal(doc)}
                                >
                                  <span className="icon" style={{ fontSize: "15px" }}>content_copy</span>
                                  <span>Copy</span>
                                </button>
                                <button
                                  className="action-menu-item danger"
                                  onClick={() => handleDeleteDoc(doc)}
                                  disabled={deletingDocId === doc.id}
                                >
                                  <span className="icon" style={{ fontSize: "15px" }}>delete</span>
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {displayedDocs.length > 0 && (
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
                Showing {displayedDocs.length} document{displayedDocs.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── MODALS ── */}

      {/* 1. Create New Folder Modal */}
      {showNewFolderModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionInProgress) setShowNewFolderModal(false);
          }}
        >
          <div className="modal-box" style={{ maxWidth: "440px" }}>
            <div className="modal-header">
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <h2 className="text-headline-sm" style={{ color: "var(--color-on-surface)" }}>
                  New Folder
                </h2>
                <p className="text-body-sm" style={{ color: "var(--color-on-surface-variant)" }}>
                  Create a root-level folder to organize your documents.
                </p>
              </div>
              <button
                className="btn-icon"
                onClick={() => setShowNewFolderModal(false)}
                disabled={actionInProgress}
              >
                <span className="icon" style={{ fontSize: "20px" }}>close</span>
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label
                  htmlFor="new-folder-input"
                  className="text-label-sm"
                  style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-on-surface-variant)" }}
                >
                  Folder Name
                </label>
                <input
                  id="new-folder-input"
                  type="text"
                  placeholder="e.g. DSA, PCQ, Notes"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolder();
                  }}
                  autoFocus
                  style={{
                    padding: "8px var(--space-sm)",
                    background: "var(--color-surface-container-low)",
                    border: "1px solid var(--color-outline-variant)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.875rem",
                    color: "var(--color-on-surface)",
                    outline: "none",
                  }}
                />
              </div>
              {folderActionError && (
                <div style={{ color: "var(--color-error)", fontSize: "0.8125rem" }}>
                  {folderActionError}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn-ghost"
                onClick={() => setShowNewFolderModal(false)}
                disabled={actionInProgress}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateFolder}
                disabled={actionInProgress || !newFolderName.trim()}
              >
                {actionInProgress ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Rename Folder Modal */}
      {renamingFolder && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionInProgress) setRenamingFolder(null);
          }}
        >
          <div className="modal-box" style={{ maxWidth: "440px" }}>
            <div className="modal-header">
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <h2 className="text-headline-sm" style={{ color: "var(--color-on-surface)" }}>
                  Rename Folder
                </h2>
                <p className="text-body-sm" style={{ color: "var(--color-on-surface-variant)" }}>
                  Enter a new name for folder "{renamingFolder.name}".
                </p>
              </div>
              <button
                className="btn-icon"
                onClick={() => setRenamingFolder(null)}
                disabled={actionInProgress}
              >
                <span className="icon" style={{ fontSize: "20px" }}>close</span>
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label
                  htmlFor="rename-folder-input"
                  className="text-label-sm"
                  style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-on-surface-variant)" }}
                >
                  Folder Name
                </label>
                <input
                  id="rename-folder-input"
                  type="text"
                  value={renamedFolderName}
                  onChange={(e) => setRenamedFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmRenameFolder();
                  }}
                  autoFocus
                  style={{
                    padding: "8px var(--space-sm)",
                    background: "var(--color-surface-container-low)",
                    border: "1px solid var(--color-outline-variant)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.875rem",
                    color: "var(--color-on-surface)",
                    outline: "none",
                  }}
                />
              </div>
              {folderActionError && (
                <div style={{ color: "var(--color-error)", fontSize: "0.8125rem" }}>
                  {folderActionError}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn-ghost"
                onClick={() => setRenamingFolder(null)}
                disabled={actionInProgress}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirmRenameFolder}
                disabled={actionInProgress || !renamedFolderName.trim()}
              >
                {actionInProgress ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Rename Document Modal */}
      {renamingDoc && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionInProgress) setRenamingDoc(null);
          }}
        >
          <div className="modal-box" style={{ maxWidth: "440px" }}>
            <div className="modal-header">
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <h2 className="text-headline-sm" style={{ color: "var(--color-on-surface)" }}>
                  Rename Document
                </h2>
                <p className="text-body-sm" style={{ color: "var(--color-on-surface-variant)" }}>
                  Document filename must end with .txt
                </p>
              </div>
              <button
                className="btn-icon"
                onClick={() => setRenamingDoc(null)}
                disabled={actionInProgress}
              >
                <span className="icon" style={{ fontSize: "20px" }}>close</span>
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label
                  htmlFor="rename-doc-input"
                  className="text-label-sm"
                  style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-on-surface-variant)" }}
                >
                  Filename
                </label>
                <input
                  id="rename-doc-input"
                  type="text"
                  value={newDocFilename}
                  onChange={(e) => setNewDocFilename(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmRenameDoc();
                  }}
                  autoFocus
                  style={{
                    padding: "8px var(--space-sm)",
                    background: "var(--color-surface-container-low)",
                    border: "1px solid var(--color-outline-variant)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.875rem",
                    color: "var(--color-on-surface)",
                    fontFamily: "var(--font-mono)",
                    outline: "none",
                  }}
                />
              </div>
              {renameDocError && (
                <div style={{ color: "var(--color-error)", fontSize: "0.8125rem" }}>
                  {renameDocError}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn-ghost"
                onClick={() => setRenamingDoc(null)}
                disabled={actionInProgress}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirmRenameDoc}
                disabled={actionInProgress || !newDocFilename.trim()}
              >
                {actionInProgress ? "Renaming..." : "Rename"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Move Document Modal */}
      {moveDoc && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionInProgress) setMoveDoc(null);
          }}
        >
          <div className="modal-box" style={{ maxWidth: "440px" }}>
            <div className="modal-header">
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <h2 className="text-headline-sm" style={{ color: "var(--color-on-surface)" }}>
                  Move to
                </h2>
                <p className="text-body-sm" style={{ color: "var(--color-on-surface-variant)" }}>
                  Select destination folder for "{moveDoc.filename}".
                </p>
              </div>
              <button
                className="btn-icon"
                onClick={() => setMoveDoc(null)}
                disabled={actionInProgress}
              >
                <span className="icon" style={{ fontSize: "20px" }}>close</span>
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {/* Root Option */}
                <label
                  className={`destination-radio-item ${targetFolderId === null ? "selected" : ""}`}
                  onClick={() => setTargetFolderId(null)}
                >
                  <input
                    type="radio"
                    name="move-destination"
                    checked={targetFolderId === null}
                    onChange={() => setTargetFolderId(null)}
                    style={{ cursor: "pointer" }}
                  />
                  <span className="icon" style={{ fontSize: "18px", color: "var(--color-outline)" }}>home</span>
                  <span className="text-body-sm" style={{ fontWeight: 500, color: "var(--color-on-surface)" }}>
                    Root
                  </span>
                </label>

                {/* Folder Options */}
                {folders.map((f) => (
                  <label
                    key={f.id}
                    className={`destination-radio-item ${targetFolderId === f.id ? "selected" : ""}`}
                    onClick={() => setTargetFolderId(f.id)}
                  >
                    <input
                      type="radio"
                      name="move-destination"
                      checked={targetFolderId === f.id}
                      onChange={() => setTargetFolderId(f.id)}
                      style={{ cursor: "pointer" }}
                    />
                    <span className="icon" style={{ fontSize: "18px", color: "var(--color-primary)" }}>folder</span>
                    <span className="text-body-sm" style={{ fontWeight: 500, color: "var(--color-on-surface)" }}>
                      {f.name}
                    </span>
                  </label>
                ))}
              </div>

              {destModalError && (
                <div style={{ color: "var(--color-error)", fontSize: "0.8125rem" }}>
                  {destModalError}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn-ghost"
                onClick={() => setMoveDoc(null)}
                disabled={actionInProgress}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirmMove}
                disabled={actionInProgress}
              >
                {actionInProgress ? "Moving..." : "Move"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Copy Document Modal */}
      {copyDoc && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionInProgress) setCopyDoc(null);
          }}
        >
          <div className="modal-box" style={{ maxWidth: "440px" }}>
            <div className="modal-header">
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <h2 className="text-headline-sm" style={{ color: "var(--color-on-surface)" }}>
                  Copy to
                </h2>
                <p className="text-body-sm" style={{ color: "var(--color-on-surface-variant)" }}>
                  Select destination folder for copied "{copyDoc.filename}".
                </p>
              </div>
              <button
                className="btn-icon"
                onClick={() => setCopyDoc(null)}
                disabled={actionInProgress}
              >
                <span className="icon" style={{ fontSize: "20px" }}>close</span>
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {/* Root Option */}
                <label
                  className={`destination-radio-item ${targetFolderId === null ? "selected" : ""}`}
                  onClick={() => setTargetFolderId(null)}
                >
                  <input
                    type="radio"
                    name="copy-destination"
                    checked={targetFolderId === null}
                    onChange={() => setTargetFolderId(null)}
                    style={{ cursor: "pointer" }}
                  />
                  <span className="icon" style={{ fontSize: "18px", color: "var(--color-outline)" }}>home</span>
                  <span className="text-body-sm" style={{ fontWeight: 500, color: "var(--color-on-surface)" }}>
                    Root
                  </span>
                </label>

                {/* Folder Options */}
                {folders.map((f) => (
                  <label
                    key={f.id}
                    className={`destination-radio-item ${targetFolderId === f.id ? "selected" : ""}`}
                    onClick={() => setTargetFolderId(f.id)}
                  >
                    <input
                      type="radio"
                      name="copy-destination"
                      checked={targetFolderId === f.id}
                      onChange={() => setTargetFolderId(f.id)}
                      style={{ cursor: "pointer" }}
                    />
                    <span className="icon" style={{ fontSize: "18px", color: "var(--color-primary)" }}>folder</span>
                    <span className="text-body-sm" style={{ fontWeight: 500, color: "var(--color-on-surface)" }}>
                      {f.name}
                    </span>
                  </label>
                ))}
              </div>

              {destModalError && (
                <div style={{ color: "var(--color-error)", fontSize: "0.8125rem" }}>
                  {destModalError}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn-ghost"
                onClick={() => setCopyDoc(null)}
                disabled={actionInProgress}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirmCopy}
                disabled={actionInProgress}
              >
                {actionInProgress ? "Copying..." : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Delete Document Confirmation Modal */}
      {docToDelete && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionInProgress) setDocToDelete(null);
          }}
        >
          <div className="modal-box" style={{ maxWidth: "440px" }}>
            <div className="modal-header">
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <h2 className="text-headline-sm" style={{ color: "var(--color-on-surface)" }}>
                  Delete Document
                </h2>
                <p className="text-body-sm" style={{ color: "var(--color-on-surface-variant)" }}>
                  Are you sure you want to delete "{docToDelete.filename}"? This will remove its postings from the inverted index.
                </p>
              </div>
              <button
                className="btn-icon"
                onClick={() => setDocToDelete(null)}
                disabled={actionInProgress}
              >
                <span className="icon" style={{ fontSize: "20px" }}>close</span>
              </button>
            </div>
            <div className="modal-footer">
              <button
                className="btn-ghost"
                onClick={() => setDocToDelete(null)}
                disabled={actionInProgress}
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                id="confirm-delete-doc-btn"
                disabled={actionInProgress}
                onClick={async () => {
                  const target = docToDelete;
                  if (!target) return;
                  setActionInProgress(true);
                  setDeletingDocId(target.id);
                  try {
                    await api.deleteDocument(target.id);
                    setDocToDelete(null);
                    onRefresh();
                  } catch (e) {
                    alert((e as Error).message);
                  } finally {
                    setDeletingDocId(null);
                    setActionInProgress(false);
                  }
                }}
              >
                {actionInProgress ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Delete Folder Confirmation Modal */}
      {folderToDelete && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionInProgress) setFolderToDelete(null);
          }}
        >
          <div className="modal-box" style={{ maxWidth: "440px" }}>
            <div className="modal-header">
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <h2 className="text-headline-sm" style={{ color: "var(--color-on-surface)" }}>
                  Delete Folder
                </h2>
                <p className="text-body-sm" style={{ color: "var(--color-on-surface-variant)" }}>
                  Delete folder "{folderToDelete.name}"? Documents in this folder will be safely moved to Root and will NOT be deleted.
                </p>
              </div>
              <button
                className="btn-icon"
                onClick={() => setFolderToDelete(null)}
                disabled={actionInProgress}
              >
                <span className="icon" style={{ fontSize: "20px" }}>close</span>
              </button>
            </div>
            <div className="modal-footer">
              <button
                className="btn-ghost"
                onClick={() => setFolderToDelete(null)}
                disabled={actionInProgress}
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                id="confirm-delete-folder-btn"
                disabled={actionInProgress}
                onClick={async () => {
                  const target = folderToDelete;
                  setActionInProgress(true);
                  try {
                    await api.deleteFolder(target.id);
                    if (currentFolderId === target.id) {
                      setCurrentFolderId(null);
                    }
                    setFolderToDelete(null);
                    onRefresh();
                  } catch (e) {
                    alert((e as Error).message);
                  } finally {
                    setActionInProgress(false);
                  }
                }}
              >
                {actionInProgress ? "Deleting..." : "Delete Folder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
