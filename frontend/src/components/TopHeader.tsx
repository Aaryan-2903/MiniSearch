/**
 * TopHeader.tsx
 * -------------
 * Fixed top header: breadcrumb navigation + index status indicator.
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
      <nav style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
        {pages.map((page, i) => (
          <span key={page} style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
            {i > 0 && (
              <span className="text-mono-meta" style={{ color: "var(--color-outline-variant)" }}>
                /
              </span>
            )}
            <button
              className={`breadcrumb-item${activePage === page ? " active" : ""}`}
              onClick={() => onNavigate(page)}
            >
              {PAGE_LABELS[page]}
            </button>
          </span>
        ))}
      </nav>

      {stats && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
          <span
            className={`status-dot ${statusColor(stats.index_status)}`}
            style={{ background: stats.index_status === "ready" ? "var(--color-secondary)" : "var(--color-outline)" }}
          />
          <span className="text-mono-meta" style={{ color: "var(--color-on-surface-variant)" }}>
            Index {stats.index_status}
          </span>
        </div>
      )}
    </header>
  );
}
