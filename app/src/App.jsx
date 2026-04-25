import React, { useState, useEffect, useCallback } from "react";
import TitleBar from "./components/TitleBar.jsx";
import Sidebar from "./components/Sidebar.jsx";
import DownloadPage from "./components/DownloadPage.jsx";
import HistoryPage from "./components/HistoryPage.jsx";
import SettingsPage from "./components/SettingsPage.jsx";
import BackendStatus from "./components/BackendStatus.jsx";
import "./App.css";

const API = "http://127.0.0.1:8000";

export default function App() {
  const [page, setPage] = useState("download");
  const [backendReady, setBackendReady] = useState(false);
  const [backendChecking, setBackendChecking] = useState(true);

  const [downloads, setDownloads] = useState([]);
  const [activeDownloads, setActiveDownloads] = useState([]);
  const [prefilledUrl, setPrefilledUrl] = useState("");
  const [settings, setSettings] = useState({
    downloadPath: "",
    notifications: true,
  });

  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  const [autoDownloadConfig, setAutoDownloadConfig] = useState(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API}/ping`, {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) setBackendReady(true);
      } catch {}
      setBackendChecking(false);
    };
    check();

    if (window.electron) {
      window.electron.getSettings().then(setSettings);
      window.electron.getHistory().then((data) => {
        setDownloads(data || []);
        setIsHistoryLoaded(true);
      });

      window.electron.onBackendStatus((status) => {
        if (status === "ready") setBackendReady(true);
        setBackendChecking(false);
      });

      window.electron.onDownloadUrl((rawUrl) => {
        try {
          if (rawUrl.startsWith("savedlp://")) {
            const parsed = new URL(rawUrl);
            const videoUrl = parsed.searchParams.get("url");
            if (videoUrl) {
              setPrefilledUrl(videoUrl);
              if (
                parsed.pathname.includes("download") ||
                parsed.hostname === "download"
              ) {
                setAutoDownloadConfig({
                  format: parsed.searchParams.get("format") || "mp4",
                  quality: parsed.searchParams.get("quality") || "best",
                  isAudio: parsed.searchParams.get("audio") === "true",
                });
              }
            }
          } else {
            setPrefilledUrl(rawUrl);
          }
        } catch (e) {}
        setPage("download");
      });
    }
  }, []);

  useEffect(() => {
    if (window.electron && isHistoryLoaded) {
      window.electron.saveHistory(downloads);
    }
  }, [downloads, isHistoryLoaded]);

  const addDownload = useCallback(
    (item) => setDownloads((prev) => [item, ...prev.slice(0, 49)]),
    [],
  );

  const updateDownload = useCallback(
    (id, updates) =>
      setDownloads((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      ),
    [],
  );

  const activeCount = activeDownloads.filter(
    (d) => d.status !== "done" && d.status !== "error",
  ).length;

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app-body">
        <Sidebar page={page} setPage={setPage} activeCount={activeCount} />
        <main className="app-main">
          {backendChecking ? (
            <BackendStatus status="checking" />
          ) : !backendReady ? (
            <BackendStatus
              status="error"
              onRetry={() => {
                setBackendChecking(true);
                fetch(`${API}/ping`)
                  .then((r) => {
                    if (r.ok) setBackendReady(true);
                  })
                  .catch(() => {})
                  .finally(() => setBackendChecking(false));
              }}
            />
          ) : (
            <>
              <div
                style={{
                  display: page === "download" ? "block" : "none",
                  height: "100%",
                }}
              >
                <DownloadPage
                  api={API}
                  prefilledUrl={prefilledUrl}
                  onPrefilledConsumed={() => setPrefilledUrl("")}
                  onDownloadAdded={addDownload}
                  onDownloadUpdated={updateDownload}
                  settings={settings}
                  setSettings={setSettings}
                  activeDownloads={activeDownloads}
                  setActiveDownloads={setActiveDownloads}
                  autoDownloadConfig={autoDownloadConfig}
                  setAutoDownloadConfig={setAutoDownloadConfig}
                />
              </div>
              <div
                style={{
                  display: page === "history" ? "block" : "none",
                  height: "100%",
                }}
              >
                <HistoryPage
                  downloads={downloads}
                  setDownloads={setDownloads}
                  activeDownloads={activeDownloads}
                />
              </div>
              <div
                style={{
                  display: page === "settings" ? "block" : "none",
                  height: "100%",
                }}
              >
                <SettingsPage settings={settings} setSettings={setSettings} />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
