const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  minimize: () => ipcRenderer.invoke("window-minimize"),
  maximize: () => ipcRenderer.invoke("window-maximize"),
  close: () => ipcRenderer.invoke("window-close"),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  getHistory: () => ipcRenderer.invoke("get-history"),
  saveHistory: (downloads) => ipcRenderer.invoke("save-history", downloads),
  setDownloadPath: () => ipcRenderer.invoke("set-download-path"),
  openFolder: (p) => ipcRenderer.invoke("open-folder", p),
  showItemInFolder: (p) => ipcRenderer.invoke("show-item-in-folder", p),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  onDownloadUrl: (cb) => ipcRenderer.on("download-url", (_, url) => cb(url)),

  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  onUpdateAvailable: (cb) =>
    ipcRenderer.on("update-available", (_, info) => cb(info)),
  onUpdateNotAvailable: (cb) =>
    ipcRenderer.on("update-not-available", (_, info) => cb(info)),
  onDownloadProgress: (cb) =>
    ipcRenderer.on("download-progress", (_, prog) => cb(prog)),
  onUpdateDownloaded: (cb) =>
    ipcRenderer.on("update-downloaded", (_, info) => cb(info)),
  onUpdaterError: (cb) => ipcRenderer.on("updater-error", (_, err) => cb(err)),
});
