let modalOpen = false;
let selectedQuality = "best";
let selectedFormat = "mp4";
let isAudio = false;

const API_BASE = "https://save-dlp-production.up.railway.app";

// ─── Module-level cache ───────────────────────────────────────────────────────
const urlCache = {}; // { [url]: { formats, thumbnail } }
let activeDownload = null; // { id, progress, failed, intervalId, totalBytes }

// ─── Shadow DOM host ──────────────────────────────────────────────────────────
function createShadowHost() {
  const host = document.createElement("div");
  host.id = "dlp-shadow-host";
  host.style.cssText =
    "all:unset;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }

    #dlp-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.78);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: all;
    }

    .dlp-modal {
      width: 480px;
      max-height: 88vh;
      background: #1e1e1e;
      border-radius: 22px;
      padding: 26px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 40px rgba(0,0,0,0.7);
      color: white;
      overflow: hidden;
    }

    .dlp-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      margin-bottom: 18px;
    }

    .title { font-size: 20px; font-weight: 700; color: #fff; }

    .dlp-close {
      background: #ff0000;
      color: white;
      padding: 6px 13px;
      border-radius: 10px;
      cursor: pointer;
      font-weight: bold;
      font-size: 15px;
      border: none;
      transition: background 0.2s;
    }
    .dlp-close:hover { background: #cc0000; }

    .loader {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      padding: 36px 0;
      color: #aaa;
      font-size: 14px;
    }

    #content {
      display: flex;
      flex-direction: column;
      gap: 18px;
      overflow-y: auto;
      overflow-x: hidden;
      flex: 1;
      padding-right: 2px;
    }
    #content::-webkit-scrollbar { width: 4px; }
    #content::-webkit-scrollbar-track { background: transparent; }
    #content::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }

    .thumb-wrap {
      width: 100%;
      aspect-ratio: 16 / 9;
      border-radius: 12px;
      overflow: hidden;
      position: relative;
      background: #000; 
      flex-shrink: 0;
    }
    .thumb-wrap img {
      width: 100%;
      height: 100%;
      object-fit: contain; 
      display: block;
    }
    .thumb-dl {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(0,0,0,0.65);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 5px 10px;
      font-size: 12px;
      cursor: pointer;
    }
    .thumb-dl:hover { background: rgba(0,0,0,0.9); }

    .section { display: flex; flex-direction: column; gap: 10px; }
    .section label { color: #999; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; }

    select {
      background: #2a2a2a;
      color: white;
      border: none;
      padding: 10px 14px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 14px;
      width: 100%;
      outline: none;
    }

    .tiles { display: flex; gap: 8px; flex-wrap: wrap; }

    .tile {
      padding: 9px 14px;
      border-radius: 12px;
      background: #2a2a2a;
      color: #ccc;
      cursor: pointer;
      font-size: 13px;
      transition: background 0.15s, color 0.15s;
      user-select: none;
      border: none;
    }
    .tile:hover { background: #383838; color: white; }
    .tile.active { background: #ff0000; color: white; }

    .divider { height: 1px; background: #2e2e2e; flex-shrink: 0; }

    .dlp-footer { flex-shrink: 0; padding-top: 18px; }

    #downloadBtn {
      position: relative;
      width: 100%;
      padding: 14px;
      border-radius: 14px;
      background: #2a2a2a;
      color: white;
      border: none;
      font-weight: 700;
      font-size: 15px;
      cursor: pointer;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    #downloadBtn:hover:not(:disabled) { background: #3a3a3a; }
    #downloadBtn:disabled { cursor: default; }

    #progressFill {
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      width: 0%;
      background: #ff0000;
      transition: width 0.4s ease;
      z-index: 0;
    }

    #btn-text {
      position: relative;
      z-index: 1;
    }
  `;

  shadow.appendChild(style);
  return { host, shadow };
}

// ─── Inject Save button ───────────────────────────────────────────────────────
function injectButton() {
  if (document.getElementById("save-dlp-btn")) return;
  const container = document.querySelector("#top-level-buttons-computed");
  if (!container) return;

  const btn = document.createElement("button");
  btn.id = "save-dlp-btn";
  btn.style.cssText = `
    display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 16px;
    background:#272727;color:white;border-radius:18px;border:none;font-size:14px;
    cursor:pointer;font-family:inherit;
  `;
  btn.innerHTML = `
    <svg height="20" viewBox="0 0 24 24" width="20" fill="white">
      <path d="M5 20h14v-2H5v2zm7-18l-5.5 5.5h4v6h3v-6h4L12 2z"/>
    </svg>
    <span>Save</span>
  `;
  btn.onclick = openModal;
  container.appendChild(btn);
}


console.log("API_BASE:", API_BASE);

// ─── Open modal ───────────────────────────────────────────────────────────────
async function openModal() {
  if (modalOpen) return;
  modalOpen = true;

  const { host, shadow } = createShadowHost();

  const overlay = document.createElement("div");
  overlay.id = "dlp-overlay";
  overlay.onclick = (e) => {
    if (e.target === overlay) closeModal(host);
  };

  overlay.innerHTML = `
    <div class="dlp-modal">
      <div class="dlp-header">
        <span class="title">Save-DLP</span>
        <button class="dlp-close" id="dlp-close-btn">✕</button>
      </div>

      <div id="loader" class="loader">Fetching formats…</div>

      <div id="content" style="display:none">
        <div class="thumb-wrap" id="thumb-wrap" style="display:none">
          <img id="thumb-img" alt="thumbnail" />
          <button class="thumb-dl" id="thumb-dl-btn">⬇ Thumbnail</button>
        </div>

        <div class="section">
          <label>Format</label>
          <select id="format">
            <option value="mp4">MP4</option>
            <option value="mkv">MKV (with subs)</option>
          </select>
        </div>

        <div class="section">
          <label>Video Quality</label>
          <div class="tiles" id="qualityTiles"></div>
        </div>

        <div class="divider"></div>

        <div class="section">
          <label>Audio Only</label>
          <div class="tiles" id="audioTiles">
            <div class="tile" data-format="mp3">MP3 (Best)</div>
          </div>
        </div>
      </div>

      <div class="dlp-footer" id="dlp-footer" style="display:none">
        <button id="downloadBtn">
          <div id="progressFill"></div>
          <span id="btn-text">⬇ Download</span>
        </button>
      </div>
    </div>
  `;

  shadow.appendChild(overlay);
  shadow.getElementById("dlp-close-btn").onclick = () => closeModal(host);

  const escHandler = (e) => {
    if (e.key === "Escape") closeModal(host);
  };
  document.addEventListener("keydown", escHandler);
  host._escHandler = escHandler;

  if (activeDownload) {
    shadow.getElementById("loader").style.display = "none";
    shadow.getElementById("content").style.display = "flex";
    shadow.getElementById("dlp-footer").style.display = "block";

    const btn = shadow.getElementById("downloadBtn");
    const progressFill = shadow.getElementById("progressFill");
    const btnText = shadow.getElementById("btn-text");

    const p = activeDownload.progress || 0;
    progressFill.style.width = `${p}%`;

    if (activeDownload.failed) {
      progressFill.style.background = "#cc3333";
      progressFill.style.width = "100%";
      btnText.textContent = "Download failed - Try again";
      btn.disabled = false;
      btn.onclick = () => {
        activeDownload = null;
        closeModal(host);
        openModal();
      };
    } else {
      btn.disabled = true;
      btnText.textContent = `Downloading... ${Math.floor(p)}%`;
      attachProgressPolling(activeDownload.id, shadow, host);
    }
    return;
  }

  selectedQuality = "best";
  selectedFormat = "mp4";
  isAudio = false;

  const currentUrl = window.location.href;

  if (urlCache[currentUrl]) {
    shadow.getElementById("loader").style.display = "none";
    renderContent(
      shadow,
      host,
      urlCache[currentUrl].formats,
      urlCache[currentUrl].thumbnail,
    );
    return;
  }

  const fallbackFormats = [
    { height: 2160, fps: 30, filesize: null },
    { height: 1080, fps: 30, filesize: null },
    { height: 720, fps: 30, filesize: null },
  ];

  let formats = fallbackFormats;
  let thumbnail = null;

  try {
    const [fRes, tRes] = await Promise.all([
      fetch(`${API_BASE}/formats?url=${encodeURIComponent(currentUrl)}`),
      fetch(`${API_BASE}/thumbnail?url=${encodeURIComponent(currentUrl)}`),
    ]);
    if (fRes.ok) formats = (await fRes.json()).formats || formats;
    if (tRes.ok) thumbnail = (await tRes.json()).thumbnail;
  } catch (e) {
    console.warn("Save-DLP: server unreachable", e);
  }

  urlCache[currentUrl] = { formats, thumbnail };
  renderContent(shadow, host, formats, thumbnail);
}

// ─── Render modal content ─────────────────────────────────────────────────────
function renderContent(shadow, host, formats, thumbnail) {
  if (thumbnail) {
    shadow.getElementById("thumb-img").src = thumbnail;
    shadow.getElementById("thumb-wrap").style.display = "block";
    shadow.getElementById("thumb-dl-btn").onclick = () =>
      window.open(thumbnail, "_blank");
  }

  const tilesEl = shadow.getElementById("qualityTiles");
  let html = `<div class="tile active" data-q="best">Best</div>`;
  formats.forEach((f) => {
    const size = f.filesize
      ? ` • ${(f.filesize / (1024 * 1024)).toFixed(1)}MB`
      : "";
    html += `<div class="tile" data-q="${f.height}">${f.height}p • ${f.fps || 30}fps${size}</div>`;
  });
  tilesEl.innerHTML = html;

  shadow.getElementById("loader").style.display = "none";
  shadow.getElementById("content").style.display = "flex";
  shadow.getElementById("dlp-footer").style.display = "block";

  setupTiles(shadow);
  shadow.getElementById("downloadBtn").onclick = () =>
    startDownload(shadow, host);
}

// ─── Tile interaction ─────────────────────────────────────────────────────────
function setupTiles(shadow) {
  shadow.querySelectorAll("#qualityTiles .tile").forEach((tile) => {
    tile.onclick = () => {
      isAudio = false;
      shadow
        .querySelectorAll(".tile")
        .forEach((t) => t.classList.remove("active"));
      tile.classList.add("active");
      selectedQuality = tile.dataset.q;
      selectedFormat = shadow.getElementById("format").value;
    };
  });
  shadow.querySelectorAll("#audioTiles .tile").forEach((tile) => {
    tile.onclick = () => {
      isAudio = true;
      shadow
        .querySelectorAll(".tile")
        .forEach((t) => t.classList.remove("active"));
      tile.classList.add("active");
      selectedFormat = tile.dataset.format;
      selectedQuality = "best";
    };
  });
}

// ─── Start download ───────────────────────────────────────────────────────────
async function startDownload(shadow, host) {
  const format = isAudio
    ? selectedFormat
    : shadow.getElementById("format").value || selectedFormat;
  const btn = shadow.getElementById("downloadBtn");
  const btnText = shadow.getElementById("btn-text");

  btn.disabled = true;
  btnText.textContent = "Starting…";

  // Grab the expected total filesize to calculate MB/s accurately
  let totalBytes = null;
  const cachedUrl = urlCache[window.location.href];
  if (cachedUrl && cachedUrl.formats) {
    let fInfo;
    if (selectedQuality === "best") {
      fInfo = cachedUrl.formats[0];
    } else {
      fInfo = cachedUrl.formats.find(
        (f) => String(f.height) === String(selectedQuality),
      );
    }
    if (fInfo && fInfo.filesize) totalBytes = fInfo.filesize;
  }

  try {
    const res = await fetch(
      `${API_BASE}/download?url=${encodeURIComponent(window.location.href)}&format=${format}&quality=${selectedQuality}`,
    );
    const { id } = await res.json();
    activeDownload = {
      id,
      progress: 0,
      failed: false,
      intervalId: null,
      totalBytes,
    };
    attachProgressPolling(id, shadow, host);
  } catch (e) {
    btn.disabled = false;
    btnText.textContent = "Error: server unreachable";
  }
}

// ─── Progress polling (Updated with Speed + ETA logic) ─────────────────────────
function attachProgressPolling(id, shadow, host) {
  if (activeDownload && activeDownload.intervalId) {
    clearInterval(activeDownload.intervalId);
  }

  const btn = shadow.getElementById("downloadBtn");
  const progressFill = shadow.getElementById("progressFill");
  const btnText = shadow.getElementById("btn-text");

  btn.disabled = true;

  // Tracking variables for speed + ETA
  let lastProgress = activeDownload ? activeDownload.progress || 0 : 0;
  let lastTime = Date.now();
  let smoothedSpeed = 0; // % per second

  function formatETA(seconds) {
    if (!seconds || seconds === Infinity || seconds < 0) return "--";

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  const interval = setInterval(async () => {
    try {
      const pRes = await fetch(`${API_BASE}/progress?id=${id}`);
      const { progress } = await pRes.json();

      if (activeDownload && activeDownload.id === id) {
        activeDownload.progress = progress;
      }

      if (progress === -1) {
        clearInterval(interval);
        if (activeDownload) activeDownload.failed = true;
        btn.disabled = false;
        btnText.textContent = "Download failed";
        progressFill.style.background = "#cc3333";
        progressFill.style.width = "100%";
        return;
      }

      const p = Math.min(progress, 100);
      progressFill.style.width = `${p}%`;

      // ─── SPEED + ETA CALCULATION ───
      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000;
      const deltaProgress = p - lastProgress;

      let speed = 0;
      if (deltaTime > 0 && deltaProgress > 0) {
        speed = deltaProgress / deltaTime; // % per sec
      }

      // Smooth speed (important for premium feel)
      smoothedSpeed = smoothedSpeed * 0.7 + speed * 0.3;

      let eta = 0;
      if (smoothedSpeed > 0) {
        eta = (100 - p) / smoothedSpeed;
      }

      lastProgress = p;
      lastTime = now;

      // ─── UI TEXT ───
      if (p < 100 && p > 2) {
        const etaText = formatETA(eta);
        let speedText = "";

        // Calculate actual MB/s if total bytes are known, otherwise fallback
        if (activeDownload && activeDownload.totalBytes) {
          const mbps =
            ((smoothedSpeed / 100) * activeDownload.totalBytes) / (1024 * 1024);
          speedText = `${mbps.toFixed(1)} MB/s`;
        } else {
          speedText = `${smoothedSpeed.toFixed(1)} %/s`;
        }

        btnText.textContent = `Downloading ${Math.floor(p)}% • ${speedText} • ${etaText}`;
      } else if (p <= 2) {
        btnText.textContent = `Downloading ${Math.floor(p)}%...`;
      }

      // ─── COMPLETE ───
      if (p >= 100) {
        clearInterval(interval);
        btnText.textContent = "Saving file…";
        window.location.href = `${API_BASE}/file?id=${id}`;
        activeDownload = null;
        setTimeout(() => closeModal(host), 1500);
      }
    } catch (e) {
      console.warn("Save-DLP: progress poll error", e);
    }
  }, 500);

  if (activeDownload && activeDownload.id === id) {
    activeDownload.intervalId = interval;
  }
}

// ─── Close modal ──────────────────────────────────────────────────────────────
function closeModal(host) {
  const h = host || document.getElementById("dlp-shadow-host");
  if (h) {
    if (h._escHandler) document.removeEventListener("keydown", h._escHandler);
    h.remove();
  }
  if (activeDownload && activeDownload.intervalId) {
    clearInterval(activeDownload.intervalId);
    activeDownload.intervalId = null;
  }
  modalOpen = false;
}

setInterval(injectButton, 1500);
