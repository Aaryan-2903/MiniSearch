/**
 * api.ts
 * ------
 * All backend communication is isolated here. No fetch() calls in UI components.
 * Base URL is read from VITE_API_BASE_URL (or VITE_API_URL, fallback: http://127.0.0.1:8000).
 */

const BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const defaultHeaders: Record<string, string> = isFormData
    ? {}
    : { "Content-Type": "application/json" };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options?.headers,
    },
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

export interface Folder {
  id: number;
  name: string;
  created_at: string;
  document_count: number;
}

export interface FolderList {
  total: number;
  folders: Folder[];
}

export interface DocFile {
  id: number;
  filename: string;
  file_size: number;
  token_count: number;
  uploaded_at: string;
  folder_id?: number | null;
  folder_name?: string | null;
}

export interface DocDetail extends DocFile {
  content: string;
}


export interface DocumentList {
  total: number;
  documents: DocFile[];
}

export interface TermExplanation {
  term: string;
  tf: number;
  df: number;
  idf: number;
  tfidf: number;
}

export interface Explanation {
  total_documents: number;
  query_terms_count: number;
  matched_terms_count: number;
  term_details: TermExplanation[];
}

export interface SearchResultItem {
  doc_id: number;
  filename: string;
  score: number;
  snippet: string;
  matched_terms: string[];
  folder_id?: number | null;
  folder_name?: string | null;
  explanation?: Explanation;
}

export interface SearchResponse {
  query: string;
  total_results: number;
  execution_time_ms: number;
  query_terms_count: number;
  ranking_method: string;
  match_mode: "any" | "all";
  folder_id?: number | null;
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

  listFolders(): Promise<FolderList> {
    return request<FolderList>("/folders");
  },

  createFolder(name: string): Promise<Folder> {
    return request<Folder>("/folders", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  getFolder(id: number): Promise<Folder> {
    return request<Folder>(`/folders/${id}`);
  },

  renameFolder(id: number, name: string): Promise<Folder> {
    return request<Folder>(`/folders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
  },

  deleteFolder(id: number): Promise<void> {
    return request<void>(`/folders/${id}`, { method: "DELETE" });
  },

  listDocuments(folder_id?: number | null): Promise<DocumentList> {
    const query = folder_id !== undefined && folder_id !== null ? `?folder_id=${folder_id}` : "";
    return request<DocumentList>(`/documents${query}`);
  },

  getDocument(id: number): Promise<DocDetail> {
    return request<DocDetail>(`/documents/${id}`);
  },

  uploadDocument(file: File, folder_id?: number | null): Promise<DocFile> {
    const form = new FormData();
    form.append("file", file);
    if (folder_id !== undefined && folder_id !== null) {
      form.append("folder_id", folder_id.toString());
    }
    return request<DocFile>("/documents", {
      method: "POST",
      body: form,
    });
  },

  updateDocument(id: number, payload: { filename?: string; folder_id?: number | null }): Promise<DocFile> {
    return request<DocFile>(`/documents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  copyDocument(id: number, folder_id?: number | null): Promise<DocFile> {
    return request<DocFile>(`/documents/${id}/copy`, {
      method: "POST",
      body: JSON.stringify({ folder_id: folder_id ?? null }),
    });
  },

  deleteDocument(id: number): Promise<void> {
    return request<void>(`/documents/${id}`, { method: "DELETE" });
  },

  search(
    query: string,
    top_k = 10,
    match_mode: "any" | "all" = "any",
    folder_id?: number | null
  ): Promise<SearchResponse> {
    return request<SearchResponse>("/search", {
      method: "POST",
      body: JSON.stringify({ query, top_k, match_mode, folder_id: folder_id ?? null }),
    });
  },

  getIndexStats(): Promise<IndexStats> {
    return request<IndexStats>("/index/stats");
  },

  rebuildIndex(): Promise<RebuildResponse> {
    return request<RebuildResponse>("/index/rebuild", { method: "POST" });
  },

  async downloadDocument(
    id: number,
    format: "txt" | "pdf",
    fallbackFilename?: string
  ): Promise<{ blob: Blob; filename: string }> {
    const res = await fetch(`${BASE_URL}/documents/${id}/download?format=${format}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail ?? `Download failed: ${res.status}`);
    }

    const defaultName = fallbackFilename
      ? format === "pdf"
        ? fallbackFilename.toLowerCase().endsWith(".txt")
          ? fallbackFilename.slice(0, -4) + ".pdf"
          : `${fallbackFilename}.pdf`
        : fallbackFilename
      : `document-${id}.${format}`;

    const filename = extractFilenameFromHeaders(res.headers.get("content-disposition"), defaultName);
    const blob = await res.blob();
    return { blob, filename };
  },

  async downloadAndSaveDocument(
    id: number,
    format: "txt" | "pdf",
    fallbackFilename?: string
  ): Promise<string> {
    const { blob, filename } = await this.downloadDocument(id, format, fallbackFilename);
    triggerFileDownload(blob, filename);
    return filename;
  },
};

export function extractFilenameFromHeaders(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const utf8Match = disposition.match(/filename\*=utf-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      // ignore decode failure and fall through
    }
  }
  const regularMatch = disposition.match(/filename="?([^";]+)"?/i);
  if (regularMatch?.[1]) {
    return regularMatch[1].trim();
  }
  return fallback;
}

export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
