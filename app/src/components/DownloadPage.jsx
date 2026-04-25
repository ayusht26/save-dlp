import React, { useState, useEffect, useCallback } from "react";
import "./DownloadPage.css";

const FORMAT_OPTIONS = [
  {
    value: "mp4",
    label: "MP4",
    color: "var(--blue)",
    desc: "Best compatibility",
  },
  {
    value: "mkv",
    label: "MKV",
    color: "var(--purple)",
    desc: "With subtitles",
  },
  { value: "webm", label: "WebM", color: "var(--green)", desc: "Open format" },
];
const AUDIO_OPTIONS = [
  { value: "mp3", label: "MP3", desc: "Universal audio" },
  { value: "wav", label: "WAV", desc: "Lossless audio" },
];

function formatDuration(s) {
  if (!s) return "";
  const m = Math.floor(s / 60),
    sec = Math.floor(s % 60);
  return `${Math.floor(s / 3600) > 0 ? Math.floor(s / 3600) + ":" : ""}${String(m % 60).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
function formatViews(n) {
  if (!n) return "";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B views`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M views`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K views`;
  return `${n} views`;
}
function formatSize(b) {
  if (!b) return null;
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`;
  return `${(b / 1e3).toFixed(0)} KB`;
}
function formatETA(s) {
  if (!s || s === Infinity || s < 0) return "--";
  const m = Math.floor(s / 60),
    sec = Math.floor(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export default function DownloadPage({
  api,
  prefilledUrl,
  onPrefilledConsumed,
  onDownloadAdded,
  onDownloadUpdated,
  settings,
  setSettings,
  activeDownloads,
  setActiveDownloads,
  autoDownloadConfig,
  setAutoDownloadConfig,
}) {
  const [url, setUrl] = useState("");
  const [fetchState, setFetchState] = useState("idle");
  const [videoInfo, setVideoInfo] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState("mp4");
  const [selectedQuality, setSelectedQuality] = useState("best");
  const [isAudio, setIsAudio] = useState(false);
  const [audioFormat, setAudioFormat] = useState("mp3");

  useEffect(() => {
    if (prefilledUrl) {
      setUrl(prefilledUrl);
      onPrefilledConsumed?.();
      setTimeout(() => fetchInfo(prefilledUrl), 100);
    }
  }, [prefilledUrl]);

  const fetchInfo = useCallback(
    async (targetUrl) => {
      const cleanUrl = (targetUrl || url).trim();
      if (!cleanUrl) return;
      setFetchState("loading");
      setVideoInfo(null);
      try {
        const res = await fetch(
          `${api}/info?url=${encodeURIComponent(cleanUrl)}`,
        );
        if (!res.ok) throw new Error("Fetch failed");
        setVideoInfo(await res.json());
        setFetchState("done");
        setSelectedQuality("best");
      } catch (e) {
        setFetchState("error");
      }
    },
    [url, api],
  );

  const startDownload = useCallback(
    async (overrideCfg = null) => {
      // Prevent React synthetic event objects from being treated as config
      const cfg = overrideCfg && overrideCfg.nativeEvent ? null : overrideCfg;
      if (!videoInfo) return;

      const currentIsAudio = cfg ? cfg.isAudio : isAudio;
      const currentAudioFormat = cfg ? cfg.format : audioFormat;
      const currentSelectedFormat = cfg ? cfg.format : selectedFormat;
      const currentSelectedQuality = cfg ? cfg.quality : selectedQuality;

      if (currentIsAudio && currentAudioFormat === "thumbnail") {
        if (window.electron && videoInfo.thumbnail)
          window.electron.openExternal(videoInfo.thumbnail);
        return;
      }

      const format = currentIsAudio
        ? currentAudioFormat
        : currentSelectedFormat;
      const quality = currentIsAudio ? "best" : currentSelectedQuality;
      const dlId = crypto.randomUUID();
      let totalBytes = null;

      if (!currentIsAudio && videoInfo.formats) {
        const fInfo =
          quality === "best"
            ? videoInfo.formats[0]
            : videoInfo.formats.find(
                (f) => String(f.height) === String(quality),
              );
        if (fInfo?.filesize) totalBytes = fInfo.filesize;
      }

      const downloadEntry = {
        id: dlId,
        title: videoInfo.title,
        channel: videoInfo.channel,
        thumbnail: videoInfo.thumbnail,
        format,
        quality: currentIsAudio
          ? "Audio"
          : quality === "best"
            ? "Best"
            : `${quality}p`,
        progress: 0,
        status: "starting",
        totalBytes,
        startTime: Date.now(),
        savePath: null,
      };

      setActiveDownloads((prev) => [downloadEntry, ...prev]);
      onDownloadAdded?.(downloadEntry);

      try {
        const saveDir = window.electron ? settings.downloadPath : "";
        const res = await fetch(
          `${api}/download?url=${encodeURIComponent(url)}&format=${format}&quality=${quality}&save_dir=${encodeURIComponent(saveDir)}`,
        );
        const { id } = await res.json();
        pollProgress(id, dlId, totalBytes);
      } catch (e) {
        setActiveDownloads((prev) =>
          prev.map((d) => (d.id === dlId ? { ...d, status: "error" } : d)),
        );
      }
    },
    [
      videoInfo,
      isAudio,
      audioFormat,
      selectedFormat,
      selectedQuality,
      url,
      api,
      settings.downloadPath,
      onDownloadAdded,
    ],
  );

  useEffect(() => {
    if (videoInfo && autoDownloadConfig) {
      const cfg = autoDownloadConfig;
      setAutoDownloadConfig(null);
      setIsAudio(cfg.isAudio);
      if (cfg.isAudio) setAudioFormat(cfg.format);
      else {
        setSelectedFormat(cfg.format);
        setSelectedQuality(cfg.quality);
      }
      setTimeout(() => startDownload(cfg), 100);
    }
  }, [videoInfo, autoDownloadConfig, startDownload]);

  const pollProgress = useCallback(
    (serverId, localId, totalBytes) => {
      let lastProgress = 0;
      let lastTime = Date.now();
      let smoothedSpeed = 0;
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`${api}/progress?id=${serverId}`);
          const { progress, save_path } = await res.json();
          const now = Date.now();
          const dt = (now - lastTime) / 1000;
          const dp = progress - lastProgress;
          let speed = dt > 0 && dp > 0 ? dp / dt : 0;
          smoothedSpeed = smoothedSpeed * 0.7 + speed * 0.3;
          const eta = smoothedSpeed > 0 ? (100 - progress) / smoothedSpeed : 0;
          let speedText = "";
          if (totalBytes && smoothedSpeed > 0)
            speedText = `${(((smoothedSpeed / 100) * totalBytes) / (1024 * 1024)).toFixed(1)} MB/s`;

          lastProgress = progress;
          lastTime = now;

          if (progress === -1) {
            clearInterval(interval);
            setActiveDownloads((prev) =>
              prev.map((d) =>
                d.id === localId ? { ...d, status: "error", progress: 100 } : d,
              ),
            );
            onDownloadUpdated?.(localId, { status: "error" });
            return;
          }

          setActiveDownloads((prev) =>
            prev.map((d) =>
              d.id === localId
                ? {
                    ...d,
                    progress: Math.min(progress, 100),
                    status: progress >= 100 ? "saving" : "downloading",
                    speedText,
                    eta: formatETA(eta),
                  }
                : d,
            ),
          );

          if (progress >= 100) {
            clearInterval(interval);
            if (settings.notifications !== false)
              new Notification("SaveDLP", {
                body: "Download Complete!",
                icon: videoInfo?.thumbnail,
              });
            setTimeout(() => {
              if (save_path && window.electron) {
                setActiveDownloads((prev) =>
                  prev.map((d) =>
                    d.id === localId
                      ? {
                          ...d,
                          status: "done",
                          progress: 100,
                          savePath: save_path,
                        }
                      : d,
                  ),
                );
                onDownloadUpdated?.(localId, {
                  status: "done",
                  savePath: save_path,
                });
              } else {
                window.location.href = `${api}/file?id=${serverId}`;
                setActiveDownloads((prev) =>
                  prev.map((d) =>
                    d.id === localId
                      ? { ...d, status: "done", progress: 100 }
                      : d,
                  ),
                );
                onDownloadUpdated?.(localId, { status: "done" });
              }
            }, 400);
          }
        } catch {}
      }, 500);
    },
    [api, settings.notifications, videoInfo],
  );

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.includes("youtube.com") || text.includes("youtu.be")) {
        setUrl(text);
        setTimeout(() => fetchInfo(text), 50);
      }
    } catch {}
  }, [fetchInfo]);

  const changeDir = async () => {
    if (window.electron) {
      const newPath = await window.electron.setDownloadPath();
      if (newPath) setSettings({ ...settings, downloadPath: newPath });
    }
  };

  const discardSearch = () => {
    setUrl("");
    setFetchState("idle");
    setVideoInfo(null);
  };

  const isValidUrl = url.includes("youtube.com") || url.includes("youtu.be");

  return (
    <div className="download-page">
      <div className="page-bg">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-grid" />
      </div>
      <div className="page-content">
        <section className="url-section animate-in">
          <div className="section-eyebrow">
            <div className="eyebrow-dot" />
            <span>Paste YouTube URL</span>
          </div>
          <div
            className={`url-input-wrap ${fetchState === "loading" ? "loading" : ""} ${isValidUrl ? "valid" : ""}`}
          >
            <div className="url-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <input
              className="url-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchInfo()}
              placeholder="https://www.youtube.com/watch?v=..."
              spellCheck={false}
            />
            <div className="url-actions">
              {fetchState !== "idle" && (
                <button
                  className="url-action-btn discard-btn"
                  onClick={discardSearch}
                  title="Clear search"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
              <button
                className="url-action-btn"
                onClick={handlePaste}
                title="Paste from clipboard"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                </svg>{" "}
                Paste
              </button>
              <button
                className={`fetch-btn ${fetchState === "loading" ? "fetching" : ""}`}
                onClick={() => fetchInfo()}
                disabled={!isValidUrl || fetchState === "loading"}
              >
                {fetchState === "loading" ? (
                  <>
                    <div className="btn-spinner" />
                    <span>Fetching...</span>
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <circle
                        cx="11"
                        cy="11"
                        r="8"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M21 21l-4.35-4.35"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>Fetch</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {videoInfo && (
          <section className="video-card slide-up">
            <div className="video-thumbnail-wrap">
              <img
                src={videoInfo.thumbnail}
                alt=""
                className="video-thumbnail"
              />
              <div className="thumbnail-overlay">
                {videoInfo.duration && (
                  <span className="duration-badge">
                    {formatDuration(videoInfo.duration)}
                  </span>
                )}
              </div>
            </div>
            <div className="video-meta">
              <h2 className="video-title">{videoInfo.title}</h2>
              <div className="video-stats">
                <span className="video-channel">{videoInfo.channel}</span>
                {videoInfo.view_count > 0 && (
                  <span className="stat-sep">·</span>
                )}
                {videoInfo.view_count > 0 && (
                  <span
                    className="video-views"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {formatViews(videoInfo.view_count)}
                  </span>
                )}
              </div>
            </div>
          </section>
        )}

        {videoInfo && (
          <section
            className="options-section slide-up"
            style={{ animationDelay: "80ms" }}
          >
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              <div className="options-group" style={{ flex: 1 }}>
                <div className="options-label">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <rect
                      x="2"
                      y="2"
                      width="20"
                      height="20"
                      rx="3"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M8 12h8M12 8v8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>{" "}
                  Video Format
                </div>
                <div className="format-tiles">
                  {FORMAT_OPTIONS.map((f) => (
                    <button
                      key={f.value}
                      className={`format-tile ${!isAudio && selectedFormat === f.value ? "active" : ""}`}
                      style={{ "--tile-color": f.color }}
                      onClick={() => {
                        setIsAudio(false);
                        setSelectedFormat(f.value);
                      }}
                    >
                      <span className="tile-label">{f.label}</span>
                      <span className="tile-desc">{f.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="options-group">
                <div className="options-label">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <rect
                      x="3"
                      y="3"
                      width="18"
                      height="18"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                    <path
                      d="M21 15l-5-5L5 21"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>{" "}
                  Extras
                </div>
                <button
                  className={`format-tile thumbnail-tile ${isAudio && audioFormat === "thumbnail" ? "active" : ""}`}
                  style={{ "--tile-color": "var(--purple)" }}
                  onClick={() => {
                    setIsAudio(true);
                    setAudioFormat("thumbnail");
                  }}
                >
                  <span className="tile-label">Thumbnail</span>
                  <span
                    className="tile-desc"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Open cover art (PNG)
                  </span>
                </button>
              </div>
            </div>

            {!isAudio && (
              <div className="options-group">
                <div className="options-label">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <polyline
                      points="9 22 9 12 15 12 15 22"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>{" "}
                  Quality
                </div>
                <div className="quality-tiles">
                  <button
                    className={`quality-tile ${selectedQuality === "best" ? "active" : ""}`}
                    onClick={() => setSelectedQuality("best")}
                  >
                    <span className="quality-res">Best</span>
                    <span className="quality-sub">Auto</span>
                  </button>
                  {videoInfo.formats.map((f) => (
                    <button
                      key={f.height}
                      className={`quality-tile ${selectedQuality === String(f.height) ? "active" : ""}`}
                      onClick={() => setSelectedQuality(String(f.height))}
                    >
                      <span className="quality-res">{f.height}p</span>
                      <span className="quality-sub">
                        {f.fps ? `${f.fps}fps ` : ""}
                        {f.filesize ? formatSize(f.filesize) : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="options-group">
              <div className="options-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 18V5l12-2v13"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="6"
                    cy="18"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <circle
                    cx="18"
                    cy="16"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>{" "}
                Audio Only
              </div>
              <div className="format-tiles">
                {AUDIO_OPTIONS.map((f) => (
                  <button
                    key={f.value}
                    className={`format-tile ${isAudio && audioFormat === f.value ? "active" : ""}`}
                    style={{ "--tile-color": "var(--green)" }}
                    onClick={() => {
                      setIsAudio(true);
                      setAudioFormat(f.value);
                    }}
                  >
                    <span className="tile-label">{f.label}</span>
                    <span className="tile-desc">{f.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                marginTop: "4px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  background: "var(--bg-card)",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                }}
              >
                <span>
                  Saving to:{" "}
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {settings.downloadPath}
                  </span>
                </span>
                <button
                  onClick={changeDir}
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    marginLeft: "16px",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.target.style.background = "var(--bg-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.target.style.background = "var(--bg-elevated)")
                  }
                >
                  Change
                </button>
              </div>
              <button className="download-btn" onClick={startDownload}>
                <div className="download-btn-bg" />
                <div
                  className="download-btn-content"
                  style={{
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: "1.2",
                  }}
                >
                  {isAudio && audioFormat === "thumbnail" ? (
                    <>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        style={{ marginTop: "-2px" }}
                      >
                        <path
                          d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <polyline
                          points="15 3 21 3 21 9"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <line
                          x1="10"
                          y1="14"
                          x2="21"
                          y2="3"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>Open Thumbnail Image</span>
                    </>
                  ) : (
                    <>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        style={{ marginTop: "-2px" }}
                      >
                        <path
                          d="M12 3v13m0 0l-4-4m4 4l4-4"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M4 20h16"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span>
                        Download{" "}
                        {isAudio
                          ? audioFormat.toUpperCase()
                          : `${selectedQuality === "best" ? "Best Quality" : `${selectedQuality}p`} ${selectedFormat.toUpperCase()}`}
                      </span>
                    </>
                  )}
                </div>
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
