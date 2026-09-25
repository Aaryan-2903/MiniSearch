/**
 * api.ts
 * ------
 * All backend communication is isolated here. No fetch() calls in UI components.
 * Base URL is read from the Vite env variable VITE_API_URL (defaults to localhost:8000).
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `Request failed: ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DocFile {
  id: number;
  filename: string;
  file_size: number;
  token_count: number;
  uploaded_at: string;
}

export interface DocumentList {
  total: number;
  documents: DocFile[];
}

export interface SearchResultItem {
  doc_id: number;
  filename: string;
  score: number;
  snippet: string;
  matched_terms: string[];
}

export interface SearchResponse {
  query: string;
  total_results: number;
  results: SearchResultItem[];
}

export interface IndexStats {
  total_documents: number;
  total_unique_terms: number;
  last_built_at: string | null;
  index_status: string;
}

export interface RebuildResponse {
  message: string;
  total_documents: number;
  total_unique_terms: number;
  rebuilt_at: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
}

// ── API calls ──────────────────────────────────────────────────────────────────

export const api = {
  health(): Promise<HealthResponse> {
    return request<HealthResponse>("/health");
  },

  listDocuments(): Promise<DocumentList> {
    return request<DocumentList>("/documents");
  },

  uploadDocument(file: File): Promise<DocFile> {
    const form = new FormData();
    form.append("file", file);
    return request<DocFile>("/documents", {
      method: "POST",
      body: form,
      // Do NOT set Content-Type; fetch sets it with the correct boundary
      headers: {},
    });
  },

  deleteDocument(id: number): Promise<void> {
    return request<void>(`/documents/${id}`, { method: "DELETE" });
  },

  search(query: string, top_k = 10): Promise<SearchResponse> {
    return request<SearchResponse>("/search", {
      method: "POST",
      body: JSON.stringify({ query, top_k }),
    });
  },

  getIndexStats(): Promise<IndexStats> {
    return request<IndexStats>("/index/stats");
  },

  rebuildIndex(): Promise<RebuildResponse> {
    return request<RebuildResponse>("/index/rebuild", { method: "POST" });
  },
};
