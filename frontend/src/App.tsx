/**
 * App.tsx
 * -------
 * Root application shell. Manages:
 * - Global state: active page, documents list, index stats
 * - Data fetching lifecycle (initial load + refresh triggers)
 * - Upload modal visibility
 * - Document view routing
 *
 * All API calls go through the api service layer (lib/api.ts).
 */

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopHeader } from "./components/TopHeader";
import { UploadModal } from "./components/UploadModal";
import { SearchPage } from "./pages/SearchPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { IndexPage } from "./pages/IndexPage";
import { DocumentViewPage } from "./pages/DocumentViewPage";
import { api } from "./lib/api";
import type { DocFile, IndexStats, Folder, EngineSettings } from "./lib/api";

type Page = "search" | "documents" | "index" | "settings";

export default function App() {
  const [activePage, setActivePage] = useState<Page>("search");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFolderId, setUploadFolderId] = useState<number | null>(null);
  const [viewingDoc, setViewingDoc] = useState<DocFile | null>(null);

  // Global data
  const [documents, setDocuments] = useState<DocFile[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);

  const [folders, setFolders] = useState<Folder[]>([]);

  const [stats, setStats] = useState<IndexStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [settings, setSettings] = useState<EngineSettings | null>(null);

  const fetchDocuments = useCallback(async () => {
    setDocsLoading(true);
    setDocsError(null);
    try {
      const res = await api.listDocuments();
      setDocuments(res.documents);
    } catch (e) {
      setDocsError((e as Error).message);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  const fetchFolders = useCallback(async () => {
    try {
      const res = await api.listFolders();
      setFolders(res.folders);
    } catch {
      // keep existing folders on error
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await api.getIndexStats();
      setStats(res);
    } catch (e) {
      setStatsError((e as Error).message);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.getSettings();
      setSettings(res);
    } catch {
      // keep existing
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchDocuments();
    fetchFolders();
    fetchStats();
    fetchSettings();
  }, [fetchDocuments, fetchFolders, fetchStats, fetchSettings]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  function handleUploaded() {
    refreshAll();
  }

  function handleNavigate(page: Page) {
    setActivePage(page);
    setViewingDoc(null);
  }

  function handleViewDocument(doc: DocFile) {
    setViewingDoc(doc);
    setActivePage("documents");
  }

  function handleDocumentDeleted() {
    setViewingDoc(null);
    refreshAll();
  }

  // Recent docs: last 5 by upload time
  const recentDocs = [...documents]
    .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
    .slice(0, 5);

  return (
    <>
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        onAddDocuments={() => {
          setUploadFolderId(null);
          setShowUpload(true);
        }}
        stats={stats}
      />

      <div className="main-area">
        <TopHeader
          activePage={activePage}
          onNavigate={handleNavigate}
          stats={stats}
        />

        <main className="page-content">
          {/* Document detail view overrides the normal page */}
          {viewingDoc && activePage === "documents" ? (
            <DocumentViewPage
              doc={viewingDoc}
              onBack={() => setViewingDoc(null)}
              onDeleted={handleDocumentDeleted}
            />
          ) : activePage === "search" ? (
            <SearchPage
              stats={stats}
              recentDocs={recentDocs}
              folders={folders}
              defaultMatchMode={settings?.default_search_mode ?? "any"}
              onViewDocument={handleViewDocument}
            />
          ) : activePage === "documents" ? (
            <DocumentsPage
              documents={documents}
              folders={folders}
              loading={docsLoading}
              error={docsError}
              totalTerms={stats?.total_unique_terms ?? 0}
              onAddDocuments={(folderId?: number | null) => {
                setUploadFolderId(folderId ?? null);
                setShowUpload(true);
              }}
              onRefresh={refreshAll}
              onViewDocument={handleViewDocument}
            />
          ) : activePage === "index" ? (
            <IndexPage
              stats={stats}
              loading={statsLoading}
              error={statsError}
              onRefresh={refreshAll}
              initialTab="index"
              totalSize={documents.reduce((s, d) => s + d.file_size, 0)}
            />
          ) : activePage === "settings" ? (
            // Settings routes to the Index page settings tab
            <IndexPage
              stats={stats}
              loading={statsLoading}
              error={statsError}
              onRefresh={refreshAll}
              initialTab="settings"
              totalSize={documents.reduce((s, d) => s + d.file_size, 0)}
            />
          ) : null}
        </main>
      </div>

      {showUpload && (
        <UploadModal
          folders={folders}
          defaultFolderId={uploadFolderId}
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}
    </>
  );
}

