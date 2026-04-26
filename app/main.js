const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  Tray,
  Menu,
  nativeImage,
} = require("electron");
const path = require("path");
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const { autoUpdater } = require("electron-updater");

let mainWindow;
let tray;
let backendProcess;
const BACKEND_PORT = 8000;
const isDev = process.env.NODE_ENV === "development";

const userDataPath = app.getPath("userData");
const settingsPath = path.join(userDataPath, "settings.json");
const historyPath = path.join(userDataPath, "history.json");

// Configure Auto Updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function getSettings() {
  try {
    if (fs.existsSync(settingsPath))
      return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch (e) {}
  return { downloadPath: app.getPath("downloads"), notifications: true };
}
function saveSettings(settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function getBackendPath() {
  return isDev
    ? path.join(__dirname, "..", "backend", "main.py")
    : path.join(process.resourcesPath, "backend", "backend.exe");
}

function getPythonPath() {
  if (process.platform === "win32") {
    const candidates = [
      path.join(process.resourcesPath, "python", "python.exe"),
      "python",
      "python3",
    ];
    for (const c of candidates) {
      try {
        execSync(`"${c}" --version`, { stdio: "pipe" });
        return c;
      } catch {}
    }
  }
  return "python3";
}

function startBackend() {
  const backendPath = getBackendPath();
  const cwdPath = path.dirname(backendPath);

  if (isDev) {
    const pythonPath = getPythonPath();
    backendProcess = spawn(
      pythonPath,
      [
        "-m",
        "uvicorn",
        "main:app",
        "--host",
        "127.0.0.1",
        "--port",
        String(BACKEND_PORT),
        "--log-level",
        "warning",
      ],
      { cwd: cwdPath, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
    );
  } else {
    backendProcess = spawn(backendPath, [], {
      cwd: cwdPath,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  }
}

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("savedlp", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient("savedlp");
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    const deepLink = commandLine.find((arg) => arg.startsWith("savedlp://"));
    if (deepLink && mainWindow) {
      mainWindow.webContents.send("download-url", deepLink);
    }
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send("download-url", url);
    }
  });

  async function createWindow() {
    startBackend();

    mainWindow = new BrowserWindow({
      width: 1100,
      height: 720,
      minWidth: 900,
      minHeight: 600,
      frame: false,
      backgroundColor: "#0a0a0a",
      titleBarStyle: "hidden",
      trafficLightPosition: { x: 16, y: 16 },
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
      icon: path.join(__dirname, "assets", "icon.png"),
      show: false,
    });

    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (
        (input.control || input.meta) &&
        input.key.toLowerCase() === "r" &&
        !isDev
      )
        event.preventDefault();
      if (input.key === "F5" && !isDev) event.preventDefault();
    });

    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
      if (process.platform === "win32") {
        const deepLink = process.argv.find((arg) =>
          arg.startsWith("savedlp://"),
        );
        if (deepLink) {
          setTimeout(
            () => mainWindow.webContents.send("download-url", deepLink),
            500,
          );
        }
      }
    });

    if (isDev) {
      mainWindow.loadURL("http://localhost:5173");
    } else {
      mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
    }
  }

  function createTray() {
    const iconPath = path.join(__dirname, "assets", "tray-icon.png");
    const icon = fs.existsSync(iconPath)
      ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
      : nativeImage.createEmpty();

    tray = new Tray(icon);
    tray.setToolTip("SaveDLP");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Open SaveDLP", click: () => mainWindow?.show() },
        { type: "separator" },
        { label: "Quit", click: () => app.quit() },
      ]),
    );
    tray.on("double-click", () => mainWindow?.show());
  }

  ipcMain.handle("window-minimize", () => mainWindow?.minimize());
  ipcMain.handle("window-maximize", () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle("window-close", () => mainWindow?.hide());

  ipcMain.handle("get-settings", () => getSettings());
  ipcMain.handle("update-settings", (_, newSettings) =>
    saveSettings(newSettings),
  );

  ipcMain.handle("get-history", () => {
    try {
      if (fs.existsSync(historyPath))
        return JSON.parse(fs.readFileSync(historyPath, "utf8"));
    } catch (e) {}
    return [];
  });
  ipcMain.handle("save-history", (_, downloads) =>
    fs.writeFileSync(historyPath, JSON.stringify(downloads, null, 2)),
  );

  ipcMain.handle("set-download-path", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const settings = getSettings();
      settings.downloadPath = result.filePaths[0];
      saveSettings(settings);
      return settings.downloadPath;
    }
    return null;
  });

  ipcMain.handle("open-folder", (_, folderPath) => shell.openPath(folderPath));
  ipcMain.handle("show-item-in-folder", (_, filePath) =>
    shell.showItemInFolder(filePath),
  );
  ipcMain.handle("open-external", (_, url) => shell.openExternal(url));
  ipcMain.handle("get-app-version", () => app.getVersion());

  // OTA Updater IPC
  ipcMain.handle("check-for-updates", async () => {
    try {
      return await autoUpdater.checkForUpdates();
    } catch (e) {
      mainWindow?.webContents.send("updater-error", e.message);
    }
  });
  ipcMain.handle("download-update", () => autoUpdater.downloadUpdate());
  ipcMain.handle("install-update", () => autoUpdater.quitAndInstall());

  autoUpdater.on("update-available", (info) =>
    mainWindow?.webContents.send("update-available", info),
  );
  autoUpdater.on("update-not-available", (info) =>
    mainWindow?.webContents.send("update-not-available", info),
  );
  autoUpdater.on("download-progress", (progress) =>
    mainWindow?.webContents.send("download-progress", progress),
  );
  autoUpdater.on("update-downloaded", (info) =>
    mainWindow?.webContents.send("update-downloaded", info),
  );
  autoUpdater.on("error", (err) =>
    mainWindow?.webContents.send("updater-error", err.message),
  );

  app.whenReady().then(() => {
    createWindow();
    createTray();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
    }
  });
  app.on("before-quit", () => {
    if (backendProcess) backendProcess.kill();
  });
}
