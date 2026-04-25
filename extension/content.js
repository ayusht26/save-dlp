let modalOpen = false;
let selectedQuality = "best";
let selectedFormat = "mp4";
let isAudio = false;
let audioFormat = "mp3";
const urlCache = {};
const API = "http://127.0.0.1:8000";

// ─── Button Injection ─────────────────────────────────────────────────────────

function injectButton() {
  if (document.getElementById("savedlp-btn")) return;
  if (!window.location.pathname.startsWith("/watch")) return;
  const container = document.querySelector("#top-level-buttons-computed");
  if (!container) return;

  const btn = document.createElement("button");
  btn.id = "savedlp-btn";
  btn.innerHTML = `
    <svg height="18" viewBox="0 0 24 24" width="18" fill="white" style="flex-shrink:0">
      <path d="M12 3v13m0 0l-4-4m4 4l4-4M4 20h16" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>
    <span>Save</span>
  `;
  btn.onclick = openModal;
  container.appendChild(btn);
}

function removeButton() {
  const btn = document.getElementById("savedlp-btn");
  if (btn) btn.remove();
}

// ─── YouTube SPA Navigation Detection ────────────────────────────────────────
// YouTube never does a full page reload — it uses the History API (pushState).
// We use 3 layers to catch every navigation reliably:
//   1. yt-navigate-finish  — YouTube's own event, most reliable when it fires
//   2. MutationObserver on <title> — YouTube updates title on every navigation
//   3. Polling interval    — safety net, also handles already-loaded watch pages

let lastUrl = location.href;

// Attempt injection repeatedly until the button bar is rendered (it renders async after nav)
function waitAndInject() {
  let attempts = 0;
  const MAX = 25; // 25 × 300ms = 7.5 seconds max wait
  const id = setInterval(() => {
    attempts++;
    injectButton();
    if (document.getElementById("savedlp-btn") || attempts >= MAX) {
      clearInterval(id);
    }
  }, 300);
}

function handleNavigation(newUrl) {
  if (newUrl === lastUrl) return;
  lastUrl = newUrl;
  removeButton();
  if (window.location.pathname.startsWith("/watch")) {
    waitAndInject();
  }
}

// Layer 1: YouTube's own SPA navigation event
document.addEventListener("yt-navigate-finish", () => {
  handleNavigation(location.href);
});

// Layer 2: MutationObserver watching the <title> tag
// YouTube updates <title> on every navigation, making it a reliable URL-change hook
const titleObserver = new MutationObserver(() => {
  handleNavigation(location.href);
});
const titleEl = document.querySelector("head > title");
if (titleEl) {
  titleObserver.observe(titleEl, { childList: true });
} else {
  // Fallback: observe <head> until <title> appears
  const headObserver = new MutationObserver(() => {
    const t = document.querySelector("head > title");
    if (t) {
      titleObserver.observe(t, { childList: true });
      headObserver.disconnect();
    }
  });
  headObserver.observe(document.head || document.documentElement, {
    childList: true,
  });
}

// Layer 3: Polling — safety net + handles already-loaded watch pages
setInterval(() => {
  if (location.href !== lastUrl) {
    handleNavigation(location.href);
  }
  // Always attempt injection on watch pages (idempotent — checks for existing btn)
  if (window.location.pathname.startsWith("/watch")) {
    injectButton();
  }
}, 800);

// Initial injection for when content script loads on an already-open watch page
if (window.location.pathname.startsWith("/watch")) {
  waitAndInject();
}

// ─── Shadow DOM Builder ───────────────────────────────────────────────────────

function buildShadow() {
  const host = document.createElement("div");
  host.id = "savedlp-host";
  host.style.cssText =
    "all:unset;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :host {
      --red: #ff2d2d; --red-dim: rgba(255,45,45,0.12); --red-glow: rgba(255,45,45,0.3);
      --bg: #0e0e12; --bg-card: #141418; --bg-elevated: #1a1a20; --bg-hover: #1e1e28;
      --border: rgba(255,255,255,0.07); --text: #f0f0f8; --muted: #666680;
      --secondary: #9090b0; --green: #22ff88; --blue: #4488ff; --purple: #aa44ff;
      --mono: 'JetBrains Mono', monospace; --sans: 'Syne', sans-serif;
      --ease: cubic-bezier(0.16, 1, 0.3, 1);
    }
    #overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.82);
      backdrop-filter: blur(14px); display: flex; align-items: center;
      justify-content: center; pointer-events: all; animation: fadeIn 0.2s var(--ease);
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)    scale(1);    }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .modal {
      width: 500px; max-height: 88vh; background: var(--bg);
      border: 1px solid var(--border); border-radius: 24px;
      display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04);
      animation: slideUp 0.3s var(--ease); font-family: var(--sans);
    }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .header-brand { display: flex; align-items: center; gap: 9px; }
    .brand-logo {
      width: 30px; height: 30px; background: var(--red-dim);
      border: 1px solid rgba(255,45,45,0.2); border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
    }
    .brand-name { font-size: 15px; font-weight: 800; color: var(--text); letter-spacing: 0.01em; }
    .close-btn {
      width: 30px; height: 30px; background: var(--bg-elevated);
      border: 1px solid var(--border); border-radius: 8px; color: var(--muted);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.15s; font-size: 16px;
    }
    .close-btn:hover { background: var(--red); border-color: var(--red); color: white; }
    .loader {
      display: flex; flex-direction: column; align-items: center; gap: 16px;
      padding: 60px 20px; color: var(--muted); font-size: 13px;
    }
    .loader-spinner {
      width: 36px; height: 36px; border: 2px solid var(--bg-elevated);
      border-top-color: var(--red); border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    .modal-body {
      flex: 1; overflow-y: auto; padding: 18px 20px;
      display: flex; flex-direction: column; gap: 20px;
    }
    .modal-body::-webkit-scrollbar { width: 4px; }
    .modal-body::-webkit-scrollbar-track { background: transparent; }
    .modal-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
    .thumb-wrap {
      position: relative; border-radius: 14px; overflow: hidden;
      aspect-ratio: 16/9; background: var(--bg-elevated); flex-shrink: 0;
    }
    .thumb-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .thumb-overlay {
      position: absolute; inset: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%);
      display: flex; align-items: flex-end; justify-content: space-between; padding: 10px 12px;
    }
    .duration-chip {
      font-family: var(--mono); font-size: 11px; font-weight: 500;
      background: rgba(0,0,0,0.75); color: white; padding: 3px 7px; border-radius: 5px;
    }
    .video-info { display: flex; flex-direction: column; gap: 4px; }
    .video-title {
      font-size: 14px; font-weight: 600; color: var(--text); line-height: 1.4;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .video-channel { font-size: 12px; color: var(--muted); }
    .section { display: flex; flex-direction: column; gap: 10px; }
    .section-label {
      display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 600;
      color: var(--muted); text-transform: uppercase; letter-spacing: 1.2px;
    }
    .label-dot { width: 4px; height: 4px; background: var(--red); border-radius: 50%; }
    .tiles { display: flex; gap: 6px; flex-wrap: wrap; }
    .tile {
      display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
      padding: 10px 16px; background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 12px; color: var(--secondary); transition: all 0.2s; min-width: 90px; cursor: pointer;
    }
    .tile-label { font-size: 13px; font-weight: 700; font-family: var(--mono); color: inherit; }
    .tile-desc { font-size: 10px; color: var(--muted); }
    .tile:hover { background: var(--bg-hover); border-color: rgba(255,255,255,0.12); color: var(--text); }
    .tile.active { background: var(--red-dim); border-color: rgba(255,45,45,0.3); color: var(--text); }
    .tile.active .tile-desc { color: var(--secondary); }
    .quality-tile {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      padding: 10px 14px; min-width: 70px; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: 12px; color: var(--secondary);
      transition: all 0.2s; cursor: pointer;
    }
    .quality-tile:hover { background: var(--bg-hover); border-color: rgba(255,255,255,0.12); color: var(--text); }
    .quality-tile.active { background: var(--red-dim); border-color: rgba(255,45,45,0.3); color: var(--text); }
    .quality-res { font-size: 14px; font-weight: 700; font-family: var(--mono); color: inherit; }
    .quality-sub { font-size: 10px; color: inherit; opacity: 0.6; font-family: var(--mono); }
    .modal-footer {
      padding: 16px 20px; border-top: 1px solid var(--border);
      flex-shrink: 0; display: flex; flex-direction: column; gap: 8px;
    }
    .dl-btn {
      position: relative; width: 100%; padding: 16px 24px; background: var(--red);
      border: none; border-radius: 14px; color: white;
      font-family: system-ui, -apple-system, sans-serif; font-size: 15px; font-weight: 700;
      cursor: pointer; overflow: hidden; display: flex; align-items: center;
      justify-content: center; gap: 8px; transition: all 0.2s var(--ease);
    }
    .dl-btn:hover { background: #ff4444; box-shadow: 0 6px 24px var(--red-glow); transform: translateY(-1px); }
    .btn-text { position: relative; z-index: 1; display: flex; align-items: center; gap: 8px; }
    .open-app-banner {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px;
      padding: 12px 14px; display: flex; align-items: center; gap: 10px;
      font-size: 12px; color: var(--secondary);
    }
    .open-app-btn {
      margin-left: auto; padding: 5px 12px; background: var(--bg-elevated);
      border: 1px solid var(--border); border-radius: 7px; color: var(--text);
      font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap;
      font-family: var(--sans); transition: all 0.15s;
    }
    .open-app-btn:hover { background: var(--bg-hover); border-color: rgba(255,45,45,0.3); color: var(--red); }
  `;
  shadow.appendChild(style);
  return { host, shadow };
}

// ─── Open Modal ───────────────────────────────────────────────────────────────

async function openModal() {
  if (modalOpen) return;
  modalOpen = true;

  const { host, shadow } = buildShadow();
  const overlay = document.createElement("div");
  overlay.id = "overlay";
  overlay.onclick = (e) => {
    if (e.target === overlay) closeModal(host);
  };

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="header-brand">
          <div class="brand-logo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#ff2d2d" opacity="0.9"/>
              <path d="M2 17l10 5 10-5" stroke="#ff2d2d" stroke-width="2" fill="none" stroke-linecap="round"/>
              <path d="M2 12l10 5 10-5" stroke="#ff2d2d" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6"/>
            </svg>
          </div>
          <span class="brand-name">SaveDLP</span>
        </div>
        <button class="close-btn" id="close-btn">✕</button>
      </div>
      <div id="loader" class="loader">
        <div class="loader-spinner"></div>
        <span>Fetching video info…</span>
      </div>
      <div id="modal-body" class="modal-body" style="display:none"></div>
      <div id="modal-footer" class="modal-footer" style="display:none">
        <button class="dl-btn" id="dl-btn">
          <div class="btn-text" id="btn-text">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="margin-top:-2px">
              <path d="M12 3v13m0 0l-4-4m4 4l4-4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M4 20h16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            <span id="btn-text-span">Download</span>
          </div>
        </button>
      </div>
    </div>
  `;

  shadow.appendChild(overlay);
  shadow.getElementById("close-btn").onclick = () => closeModal(host);

  const esc = (e) => {
    if (e.key === "Escape") closeModal(host);
  };
  document.addEventListener("keydown", esc);
  host._esc = esc;

  selectedQuality = "best";
  selectedFormat = "mp4";
  isAudio = false;

  const currentUrl = window.location.href;
  let info = urlCache[currentUrl];

  if (!info) {
    try {
      const res = await fetch(
        `${API}/info?url=${encodeURIComponent(currentUrl)}`,
      );
      if (res.ok) {
        info = await res.json();
        urlCache[currentUrl] = info;
      }
    } catch {}
  }

  if (!info) {
    info = {
      title: document.title.replace(" - YouTube", ""),
      channel: "",
      thumbnail:
        document.querySelector('meta[property="og:image"]')?.content || "",
      formats: [
        { height: 2160, fps: 30, filesize: null },
        { height: 1080, fps: 30, filesize: null },
        { height: 720, fps: 30, filesize: null },
        { height: 480, fps: 30, filesize: null },
      ],
    };
  }

  renderModal(shadow, host, info);
}

// ─── Render Modal Content ─────────────────────────────────────────────────────

function renderModal(shadow, host, info) {
  const body = shadow.getElementById("modal-body");

  const sizeFmt = (b) => {
    if (!b) return "";
    if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
    if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`;
    return `${(b / 1e3).toFixed(0)} KB`;
  };

  const durFmt = (s) => {
    if (!s) return "";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return `${h > 0 ? h + ":" : ""}${String(m).padStart(h > 0 ? 2 : 1, "0")}:${String(sec).padStart(2, "0")}`;
  };

  body.innerHTML = `
    ${
      info.thumbnail
        ? `<div class="thumb-wrap">
             <img src="${info.thumbnail}" alt="" />
             <div class="thumb-overlay">
               ${info.duration ? `<span class="duration-chip">${durFmt(info.duration)}</span>` : "<span></span>"}
             </div>
           </div>`
        : ""
    }
    <div class="video-info">
      <div class="video-title">${info.title || "Unknown title"}</div>
      ${info.channel ? `<div class="video-channel">${info.channel}</div>` : ""}
    </div>
    <div class="open-app-banner">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#ff2d2d"/>
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#ff2d2d" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      </svg>
      Open full app for more options
      <button class="open-app-btn" id="open-app-btn">Open App ↗</button>
    </div>
    <div style="display: flex; gap: 20px; flex-wrap: wrap;">
      <div class="section" style="flex: 1;">
        <div class="section-label"><div class="label-dot"></div> Video Format</div>
        <div class="tiles">
          <button class="tile format-tile active" data-fmt="mp4">
            <span class="tile-label">MP4</span><span class="tile-desc">Best compatibility</span>
          </button>
          <button class="tile format-tile" data-fmt="mkv">
            <span class="tile-label">MKV</span><span class="tile-desc">With subtitles</span>
          </button>
          <button class="tile format-tile" data-fmt="webm">
            <span class="tile-label">WebM</span><span class="tile-desc">Open format</span>
          </button>
        </div>
      </div>
      <div class="section">
        <div class="section-label">
          <div class="label-dot" style="background:var(--purple)"></div> Extras
        </div>
        <button class="tile format-tile" data-audio="thumbnail">
          <span class="tile-label">Thumbnail</span><span class="tile-desc">Open cover art (PNG)</span>
        </button>
      </div>
    </div>
    <div class="section">
      <div class="section-label"><div class="label-dot"></div> Quality</div>
      <div class="tiles" id="quality-tiles">
        <button class="quality-tile active" data-q="best">
          <span class="quality-res">Best</span><span class="quality-sub">Auto</span>
        </button>
        ${(info.formats || [])
          .map(
            (f) => `<button class="quality-tile" data-q="${f.height}">
              <span class="quality-res">${f.height}p</span>
              <span class="quality-sub">${f.fps ? `${f.fps}fps ` : ""}${sizeFmt(f.filesize)}</span>
            </button>`,
          )
          .join("")}
      </div>
    </div>
    <div class="section">
      <div class="section-label">
        <div class="label-dot" style="background:var(--green)"></div> Audio Only
      </div>
      <div class="tiles">
        <button class="tile format-tile" data-audio="mp3">
          <span class="tile-label">MP3</span><span class="tile-desc">Universal audio</span>
        </button>
        <button class="tile format-tile" data-audio="wav">
          <span class="tile-label">WAV</span><span class="tile-desc">Lossless audio</span>
        </button>
      </div>
    </div>
  `;

  shadow.getElementById("loader").style.display = "none";
  body.style.display = "flex";
  shadow.getElementById("modal-footer").style.display = "block";

  const updateDownloadButton = () => {
    const btnTextSpan = shadow.getElementById("btn-text-span");
    const svgIcon = shadow.querySelector("#btn-text svg");

    if (isAudio && audioFormat === "thumbnail") {
      btnTextSpan.textContent = "Open Thumbnail Image";
      svgIcon.innerHTML = `
        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"
              stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="15 3 21 3 21 9"
                  stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="10" y1="14" x2="21" y2="3"
              stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      `;
    } else {
      svgIcon.innerHTML = `
        <path d="M12 3v13m0 0l-4-4m4 4l4-4"
              stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4 20h16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      `;
      if (isAudio) {
        btnTextSpan.textContent = `Download ${audioFormat.toUpperCase()}`;
      } else {
        const qStr =
          selectedQuality === "best" ? "Best Quality" : `${selectedQuality}p`;
        btnTextSpan.textContent = `Download ${qStr} ${selectedFormat.toUpperCase()}`;
      }
    }
  };

  updateDownloadButton();

  // FIX: Use window.location.href (not window.open) for savedlp:// protocol links.
  // window.open() tries to open a new tab/window first, which causes Chrome to
  // throw "Unable to find Electron app" before the OS protocol handler fires.
  shadow.getElementById("open-app-btn").onclick = () => {
    const uri = `savedlp://preview?url=${encodeURIComponent(window.location.href)}`;
    window.location.href = uri;
    closeModal(host);
  };

  body.querySelectorAll(".format-tile[data-fmt]").forEach((t) => {
    t.onclick = () => {
      isAudio = false;
      body
        .querySelectorAll(".format-tile")
        .forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      selectedFormat = t.dataset.fmt;
      updateDownloadButton();
    };
  });

  body.querySelectorAll(".quality-tile").forEach((t) => {
    t.onclick = () => {
      isAudio = false;
      body
        .querySelectorAll(".quality-tile")
        .forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      selectedQuality = t.dataset.q;
      updateDownloadButton();
    };
  });

  body.querySelectorAll(".format-tile[data-audio]").forEach((t) => {
    t.onclick = () => {
      isAudio = true;
      body
        .querySelectorAll(".format-tile")
        .forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      audioFormat = t.dataset.audio;
      updateDownloadButton();
    };
  });

  // FIX: Use window.location.href (not window.open) for savedlp:// protocol links.
  shadow.getElementById("dl-btn").onclick = () => {
    if (isAudio && audioFormat === "thumbnail" && info.thumbnail) {
      window.open(info.thumbnail, "_blank");
    } else {
      const fmt = isAudio ? audioFormat : selectedFormat;
      const q = isAudio ? "best" : selectedQuality;
      const uri = `savedlp://download?url=${encodeURIComponent(window.location.href)}&format=${fmt}&quality=${q}&audio=${isAudio}`;
      window.location.href = uri;
    }
    closeModal(host);
  };
}

// ─── Close Modal ──────────────────────────────────────────────────────────────

function closeModal(host) {
  const h = host || document.getElementById("savedlp-host");
  if (h) {
    if (h._esc) document.removeEventListener("keydown", h._esc);
    h.remove();
  }
  modalOpen = false;
}
