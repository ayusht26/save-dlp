import React from "react";
import qrCode from "../../assets/qr.jpg";

export default function SettingsPage({ settings, setSettings }) {
  const handleDirectoryChange = async () => {
    if (window.electron) {
      const newPath = await window.electron.setDownloadPath();
      if (newPath) {
        setSettings({ ...settings, downloadPath: newPath });
      }
    }
  };

  const handleOpenFolder = () => {
    if (window.electron && settings.downloadPath) {
      window.electron.openFolder(settings.downloadPath);
    }
  };

  const handleGithub = () => {
    if (window.electron)
      window.electron.openExternal("https://github.com/ayusht26/save-dlp");
  };

  const toggleNotifications = () => {
    const newSettings = {
      ...settings,
      notifications: settings.notifications === false ? true : false,
    };
    setSettings(newSettings);
    if (window.electron) window.electron.updateSettings(newSettings);
  };

  return (
    <div className="download-page">
      <div className="page-bg">
        <div className="bg-orb bg-orb-2" />
        <div className="bg-grid" />
      </div>
      <div className="page-content" style={{ zIndex: 1, maxWidth: "600px" }}>
        <section className="url-section animate-in">
          <div className="section-eyebrow">
            <div className="eyebrow-dot" />
            <span>Settings</span>
          </div>

          <div
            style={{
              background: "var(--bg-card)",
              padding: "24px",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            <div>
              <h3
                style={{
                  color: "var(--text-primary)",
                  marginBottom: "6px",
                  fontSize: "15px",
                }}
              >
                Default Download Location
              </h3>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "12px",
                  marginBottom: "12px",
                }}
              >
                Choose where your videos are automatically saved.
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "var(--bg-elevated)",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  marginBottom: "12px",
                }}
              >
                <code
                  style={{
                    flex: 1,
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {settings.downloadPath}
                </code>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="url-action-btn"
                  onClick={handleDirectoryChange}
                >
                  Change Directory
                </button>
                <button className="url-action-btn" onClick={handleOpenFolder}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{ marginRight: "6px" }}
                  >
                    <path
                      d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Open Folder
                </button>
              </div>
            </div>

            <div style={{ height: "1px", background: "var(--border)" }} />

            {/* Fix 8: Added Desktop Notifications Toggle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--bg-elevated)",
                padding: "16px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
              }}
            >
              <div>
                <h4
                  style={{
                    color: "var(--text-primary)",
                    fontSize: "14px",
                    marginBottom: "4px",
                  }}
                >
                  Desktop Notifications
                </h4>
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "12px",
                    margin: 0,
                  }}
                >
                  Get alerts when your downloads finish.
                </p>
              </div>
              <button
                onClick={toggleNotifications}
                style={{
                  background:
                    settings.notifications !== false
                      ? "var(--green-dim)"
                      : "var(--bg-hover)",
                  color:
                    settings.notifications !== false
                      ? "var(--green)"
                      : "var(--text-muted)",
                  border: `1px solid ${settings.notifications !== false ? "rgba(34,255,136,0.3)" : "var(--border)"}`,
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {settings.notifications !== false ? "Enabled" : "Disabled"}
              </button>
            </div>

            <div style={{ height: "1px", background: "var(--border)" }} />

            <div>
              <h3
                style={{
                  color: "var(--text-primary)",
                  marginBottom: "6px",
                  fontSize: "15px",
                }}
              >
                Support the Developer ☕
              </h3>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "12px",
                  marginBottom: "16px",
                }}
              >
                SaveDLP is completely free and open-source. If you enjoy using
                it, consider supporting the development!
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "20px",
                  alignItems: "center",
                  background: "var(--bg-elevated)",
                  padding: "16px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                }}
              >
                <img
                  src={qrCode}
                  alt="Support QR Code"
                  style={{
                    width: "110px",
                    height: "110px",
                    borderRadius: "8px",
                    border: "2px solid rgba(255,255,255,0.1)",
                    background: "white",
                  }}
                />
                <div>
                  <h4
                    style={{
                      color: "var(--text-primary)",
                      fontSize: "14px",
                      marginBottom: "6px",
                    }}
                  >
                    Donate via UPI
                  </h4>
                  <div
                    style={{
                      background: "var(--bg-card)",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "10px",
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "13px",
                    }}
                  >
                    <span>UPI ID:</span>
                    <span style={{ color: "white", fontWeight: "bold" }}>
                      ayusht26@ybl
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "var(--border)" }} />

            <div>
              <h3
                style={{
                  color: "var(--text-primary)",
                  marginBottom: "6px",
                  fontSize: "15px",
                }}
              >
                About
              </h3>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "12px",
                  marginBottom: "12px",
                }}
              >
                SaveDLP v1.0.0
              </p>
              <button
                className="url-action-btn"
                onClick={handleGithub}
                style={{
                  background: "#181717",
                  color: "white",
                  borderColor: "#333",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  style={{ marginRight: "6px" }}
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                GitHub Repository
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
