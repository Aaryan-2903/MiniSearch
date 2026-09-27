/**
 * TopHeader.tsx
 * -------------
 * Application top navigation bar: clean editorial text navigation
 * with subtle separators and real-time index status indicator.
 */

import type { IndexStats } from "../lib/api";
import { statusColor } from "../lib/utils";

type Page = "search" | "documents" | "index" | "settings";

const PAGE_LABELS: Record<Page, string> = {
  search: "Search",
  documents: "Documents",
  index: "Index",
  settings: "Settings",
};

interface TopHeaderProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  stats: IndexStats | null;
}

export function TopHeader({ activePage, onNavigate, stats }: TopHeaderProps) {
  const pages: Page[] = ["search", "documents", "index", "settings"];

  return (
    <header className="top-header">
      <nav className="top-nav">
        {pages.map((page, i) => (
          <span key={page} style={{ display: "inline-flex", alignItems: "center" }}>
            {i > 0 && <span className="top-nav-sep" style={{ margin: "0 6px" }}>/</span>}
            <button
              className={`top-nav-link${activePage === page ? " active" : ""}`}
              onClick={() => onNavigate(page)}
            >
              {PAGE_LABELS[page]}
            </button>
          </span>
        ))}
      </nav>

      {stats && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            className={`status-dot ${statusColor(stats.index_status)}`}
          />
          <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
            Index {stats.index_status}
          </span>
        </div>
      )}
    </header>
  );
}
