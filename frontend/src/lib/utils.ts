/**
 * utils.ts
 * --------
 * Pure utility helpers. No side effects, no imports from app code.
 */

/** Format bytes into KB or MB with one decimal place. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format an ISO timestamp into a short human-readable date/time string. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) {
    return `Today at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) {
    return `Yesterday at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

/** Clamp a numeric score to a 0-100 percentage string. */
export function scorePercent(score: number): string {
  // Raw TF-IDF scores are unbounded. We clamp and normalise for display.
  const pct = Math.min(Math.round(score * 100), 100);
  return `${pct}%`;
}

/** Return index status label colour class (green = ready, amber = building, muted = empty). */
export function statusColor(status: string): string {
  if (status === "ready") return "bg-secondary";
  if (status === "building") return "bg-tertiary";
  return "bg-outline";
}
