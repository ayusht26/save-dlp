import React from "react";
import "./TitleBar.css";

export default function TitleBar() {
  const isElectron = !!window.electron;

  return (
    <div className="titlebar">
      <div className="titlebar-drag" />
      <div className="titlebar-brand">
        <div className="titlebar-logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L2 7l10 5 10-5-10-5z"
              fill="var(--red)"
              opacity="0.9"
            />
            <path
              d="M2 17l10 5 10-5"
              stroke="var(--red)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M2 12l10 5 10-5"
              stroke="var(--red)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              opacity="0.6"
            />
          </svg>
        </div>
        <span className="titlebar-name">SaveDLP</span>
      </div>
      <div className="titlebar-drag" />
      {isElectron && (
        <div className="titlebar-controls">
          <button
            className="ctrl-btn ctrl-min"
            onClick={() => window.electron.minimize()}
            title="Minimize"
          >
            <svg width="10" height="1" viewBox="0 0 10 1">
              <rect width="10" height="1" fill="currentColor" />
            </svg>
          </button>
          <button
            className="ctrl-btn ctrl-max"
            onClick={() => window.electron.maximize()}
            title="Maximize"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect
                x="1"
                y="1"
                width="8"
                height="8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </button>
          <button
            className="ctrl-btn ctrl-close"
            onClick={() => window.electron.close()}
            title="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <line
                x1="1"
                y1="1"
                x2="9"
                y2="9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <line
                x1="9"
                y1="1"
                x2="1"
                y2="9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
