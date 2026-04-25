import React from "react";

export default function BackendStatus({ status, onRetry }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "16px",
      }}
    >
      {status === "checking" ? (
        <>
          <div
            className="btn-spinner"
            style={{
              width: "32px",
              height: "32px",
              borderTopColor: "var(--red)",
            }}
          ></div>
          <h3 style={{ color: "var(--text-primary)" }}>Starting Engine...</h3>
        </>
      ) : (
        <>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--red)"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h3 style={{ color: "var(--text-primary)" }}>
            Backend Connection Failed
          </h3>
          <p style={{ color: "var(--text-muted)" }}>
            Could not connect to the local Python engine.
          </p>
          <button className="fetch-btn" onClick={onRetry}>
            Retry Connection
          </button>
        </>
      )}
    </div>
  );
}
