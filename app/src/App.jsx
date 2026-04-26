import React, { useState, useEffect, useCallback } from "react";
import TitleBar from "./components/TitleBar.jsx";
import Sidebar from "./components/Sidebar.jsx";
import DownloadPage from "./components/DownloadPage.jsx";
import HistoryPage from "./components/HistoryPage.jsx";
import SettingsPage from "./components/SettingsPage.jsx";
import BackendStatus from "./components/BackendStatus.jsx";
import { AnimatePresence, motion } from "framer-motion";
import { PlayCircle, X } from "lucide-react";
import "./App.css";

const API = "http://127.0.0.1:8000";

export default function App() {
  const [page, setPage] = useState("download");
  const [backendReady, setBackendReady] = useState(false);
  const [backendError, setBackendError] = useState(false);

  const [downloads, setDownloads] = useState([]);
  const [activeDownloads, setActiveDownloads] = useState([]);
  const [prefilledUrl, setPrefilledUrl] = useState("");
  const [settings, setSettings] = useState({
    downloadPath: "",
    notifications: true,
  });

  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  const [autoDownloadConfig, setAutoDownloadConfig] = useState(null);

  const [toasts, setToasts] = useState([]);

  const addToast = (title) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, title }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    let attempts = 0;
    let interval;

    const checkBackend = async () => {
      try {
        const res = await fetch(`${API}/ping`, {
          signal: AbortSignal.timeout(1000),
        });
        if (res.ok) {
          setBackendReady(true);
          setBackendError(false);
          clearInterval(interval);
        }
      } catch (e) {
        attempts++;
        if (attempts >= 10) {
          setBackendError(true);
          clearInterval(interval);
        }
      }
    };

    checkBackend();
    interval = setInterval(checkBackend, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (window.electron) {
      window.electron.getSettings().then(setSettings);
      window.electron.getHistory().then((data) => {
        setDownloads(data || []);
        setIsHistoryLoaded(true);
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
          {!backendReady ? (
            <BackendStatus
              isError={backendError}
              onRetry={() => {
                setBackendError(false);
                setBackendReady(false);
                window.location.reload();
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
                  triggerToast={addToast}
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

      {/* Magic UI Style Animated List Toasts - No Red Line */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="pointer-events-auto flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border)] p-3 pr-4 rounded-2xl shadow-2xl overflow-hidden relative"
              style={{ width: "320px" }}
            >
              <div className="flex-shrink-0 bg-[var(--red-dim)] p-2 rounded-full text-[var(--red)]">
                <PlayCircle size={18} />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Download Started
                </span>
                <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {t.title}
                </span>
              </div>
              <button
                onClick={() =>
                  setToasts((prev) => prev.filter((x) => x.id !== t.id))
                }
                className="flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--red)] transition-colors"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
