import React, { useState } from "react";
import "./HistoryPage.css";

function getStatusColor(status) {
  return (
    { done: "var(--green)", error: "var(--red)", downloading: "var(--blue)" }[
      status
    ] || "var(--text-muted)"
  );
}

// Reusable Download Item Component
function DownloadItem({ dl }) {
  const statusColor =
    {
      starting: "var(--text-muted)",
      downloading: "var(--blue)",
      saving: "var(--purple)",
      done: "var(--green)",
      error: "var(--red)",
    }[dl.status] || "var(--text-muted)";

  const statusLabel =
    {
      starting: "Starting...",
      downloading: `${Math.floor(dl.progress)}% ${dl.speedText ? `· ${dl.speedText}` : ""} ${dl.eta ? `· ETA ${dl.eta}` : ""}`,
      saving: "Saving to disk...",
      done: "Complete",
      error: "Failed",
    }[dl.status] || dl.status;

  return (
    <div className={`dl-item ${dl.status} animate-in`}>
      <div className="dl-thumb">
        {dl.thumbnail ? (
          <img src={dl.thumbnail} alt="" />
        ) : (
          <div className="dl-thumb-placeholder" />
        )}
      </div>
      <div className="dl-info">
        <div className="dl-title">{dl.title}</div>
        <div className="dl-meta">
          <span className="dl-badge" style={{ color: statusColor }}>
            {dl.format?.toUpperCase()}
          </span>
          <span className="dl-quality">{dl.quality}</span>
        </div>
        <div className="dl-progress-wrap">
          <div className="dl-progress-bar">
            <div
              className="dl-progress-fill"
              style={{
                width: `${dl.progress}%`,
                background:
                  dl.status === "error"
                    ? "var(--red)"
                    : dl.status === "done"
                      ? "var(--green)"
                      : undefined,
              }}
            />
          </div>
        </div>
        <div className="dl-status" style={{ color: statusColor }}>
          {statusLabel}
        </div>
      </div>
      <div className="dl-status-icon">
        {dl.status === "downloading" && <div className="dl-spinner" />}
        {dl.status === "done" && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 6L9 17l-5-5"
              stroke="var(--green)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {dl.status === "error" && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <line
              x1="18"
              y1="6"
              x2="6"
              y2="18"
              stroke="var(--red)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <line
              x1="6"
              y1="6"
              x2="18"
              y2="18"
              stroke="var(--red)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
    </div>
  );
}

export default function HistoryPage({
  downloads,
  setDownloads,
  activeDownloads,
}) {
  const [search, setSearch] = useState("");

  const filteredDownloads = downloads.filter(
    (dl) =>
      (dl.title || "").toLowerCase().includes(search.toLowerCase()) ||
      (dl.channel || "").toLowerCase().includes(search.toLowerCase()),
  );

  // Filter actively running downloads
  const runningDownloads = activeDownloads.filter(
    (d) => d.status !== "done" && d.status !== "error",
  );

  return (
    <div className="history-page">
      <div className="page-bg">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-grid" />
      </div>
      <div className="history-content">
        {/* Fix 3: Active Downloads Section dynamically renders here instead of the download page */}
        {runningDownloads.length > 0 && (
          <div
            className="active-downloads-section slide-up"
            style={{ marginBottom: "24px" }}
          >
            <div
              className="history-header"
              style={{ paddingBottom: "12px", borderBottom: "none" }}
            >
              <div className="history-title">
                <div
                  className="title-dot"
                  style={{
                    width: "8px",
                    height: "8px",
                    background: "var(--blue)",
                    borderRadius: "50%",
                    boxShadow: "0 0 8px rgba(68,136,255,0.5)",
                    animation: "pulse-ring 1.5s ease-out infinite",
                  }}
                />
                <h2 style={{ fontSize: "16px", color: "var(--text-primary)" }}>
                  Active Queue
                </h2>
              </div>
            </div>
            <div className="history-list">
              {runningDownloads.map((dl) => (
                <DownloadItem key={dl.id} dl={dl} />
              ))}
            </div>
          </div>
        )}

        {/* Regular History Section */}
        <div className="download-history-section">
          <div className="history-header animate-in">
            <div className="history-title">
              <div className="eyebrow-dot" />
              <h2>Download History</h2>
            </div>

            <div style={{ marginLeft: "24px", flex: 1, maxWidth: "250px" }}>
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  outline: "none",
                  fontSize: "13px",
                }}
              />
            </div>

            <div className="history-stats">
              <span className="stat-pill">
                {filteredDownloads.length} total
              </span>
              <span className="stat-pill green">
                {filteredDownloads.filter((d) => d.status === "done").length}{" "}
                completed
              </span>
            </div>
            <button className="clear-btn" onClick={() => setDownloads([])}>
              Clear All
            </button>
          </div>

          {downloads.length === 0 ? (
            <div
              className="history-empty animate-in"
              style={{ marginTop: "60px" }}
            >
              <div className="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="var(--text-muted)"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M12 7v5l3 3"
                    stroke="var(--text-muted)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3>No history yet</h3>
              <p>Your finished downloads will appear here</p>
            </div>
          ) : (
            <div className="history-list">
              {filteredDownloads.map((dl, i) => (
                <div
                  key={dl.id}
                  className="history-item animate-in"
                  style={{
                    animationDelay: `${i * 30}ms`,
                    cursor: dl.savePath ? "pointer" : "default",
                  }}
                  onClick={() => {
                    if (dl.savePath && window.electron)
                      window.electron.openFolder(dl.savePath);
                  }}
                >
                  <div className="hi-thumb">
                    {dl.thumbnail ? (
                      <img src={dl.thumbnail} alt="" />
                    ) : (
                      <div className="hi-thumb-placeholder" />
                    )}
                  </div>
                  <div className="hi-info">
                    <div className="hi-title">{dl.title}</div>
                    <div className="hi-meta">
                      <span className="hi-channel">{dl.channel}</span>
                      <span className="hi-sep">·</span>
                      <span
                        className="hi-format"
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "11px",
                        }}
                      >
                        {dl.format?.toUpperCase()} · {dl.quality}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    {dl.savePath && (
                      <button
                        className="folder-btn"
                        title="Show in folder"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.electron.showItemInFolder(dl.savePath);
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    )}
                    <div className="hi-status">
                      <div
                        className="status-dot"
                        style={{ background: getStatusColor(dl.status) }}
                      />
                      <span
                        style={{
                          color: getStatusColor(dl.status),
                          fontSize: "11px",
                          textTransform: "capitalize",
                        }}
                      >
                        {dl.status === "done" ? "Saved" : dl.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
