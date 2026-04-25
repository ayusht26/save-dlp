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
  onBackendStatus: (cb) =>
    ipcRenderer.on("backend-status", (_, status) => cb(status)),
  onDownloadUrl: (cb) => ipcRenderer.on("download-url", (_, url) => cb(url)),
});
