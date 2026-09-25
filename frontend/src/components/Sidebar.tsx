/**
 * Sidebar.tsx
 * -----------
 * Fixed left sidebar: branding, nav sections, footer stats + "Add documents" button.
 * Uses Material Symbols Outlined icons (loaded from Google Fonts in index.html).
 */

import type { IndexStats } from "../lib/api";

type Page = "search" | "documents" | "index" | "settings";

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  onAddDocuments: () => void;
  stats: IndexStats | null;
}

export function Sidebar({ activePage, onNavigate, onAddDocuments, stats }: SidebarProps) {
  function navClass(page: Page) {
    return `nav-item${activePage === page ? " active" : ""}`;
  }

  return (
    <aside className="sidebar">
      <div style={{ display: "flex", flexDirection: "column" }}>
        {/* Brand header */}
        <div
          style={{
            height: "var(--header-h)",
            padding: "0 var(--space-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--color-outline-variant)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <span
              className="icon"
              style={{ fontSize: "20px", color: "var(--color-primary)", fontVariationSettings: '"FILL" 1' }}
            >
              manage_search
            </span>
            <span className="text-headline-sm" style={{ color: "var(--color-on-surface)" }}>
              MiniSearch
            </span>
          </div>
          <kbd>⌘K</kbd>
        </div>

        {/* Library section */}
        <div style={{ paddingTop: "var(--space-md)", paddingLeft: "var(--space-sm)", paddingRight: "var(--space-sm)" }}>
          <div
            className="text-label-sm"
            style={{
              padding: "0 var(--space-sm)",
              paddingBottom: "var(--space-xs)",
              color: "var(--color-on-surface-variant)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Library
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <button className={navClass("search")} onClick={() => onNavigate("search")}>
              <span className="icon" style={{ fontSize: "18px" }}>search</span>
              <span>Search</span>
            </button>
          </nav>
        </div>

        {/* Workspace section */}
        <div
          style={{
            paddingTop: "var(--space-lg)",
            paddingLeft: "var(--space-sm)",
            paddingRight: "var(--space-sm)",
          }}
        >
          <div
            className="text-label-sm"
            style={{
              padding: "0 var(--space-sm)",
              paddingBottom: "var(--space-xs)",
              color: "var(--color-on-surface-variant)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Workspace
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <button className={navClass("documents")} onClick={() => onNavigate("documents")}>
              <span className="icon" style={{ fontSize: "18px" }}>folder</span>
              <span>Documents</span>
            </button>
            <button className={navClass("index")} onClick={() => onNavigate("index")}>
              <span className="icon" style={{ fontSize: "18px" }}>account_tree</span>
              <span>Index</span>
            </button>
            <button className={navClass("settings")} onClick={() => onNavigate("settings")}>
              <span className="icon" style={{ fontSize: "18px" }}>settings</span>
              <span>Settings</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Footer: corpus stats + add button */}
      <div
        style={{
          padding: "var(--space-md)",
          borderTop: "1px solid var(--color-outline-variant)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-sm)",
        }}
      >
        {stats && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <div className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
              {stats.total_documents} documents
            </div>
            <div className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
              {stats.total_unique_terms.toLocaleString()} indexed terms
            </div>
          </div>
        )}
        <button className="btn-ghost" onClick={onAddDocuments} style={{ width: "100%", justifyContent: "center" }}>
          <span className="icon" style={{ fontSize: "16px" }}>add</span>
          <span>Add documents</span>
        </button>
      </div>
    </aside>
  );
}
