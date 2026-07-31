const { app, BrowserWindow, dialog } = require("electron");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { startBackend } = require("./backend-process.cjs");

const root = path.resolve(__dirname, "..");
let backend;
const smoke = process.env.ELECTRON_SMOKE === "1";

function waitForBackend(retries = 50) {
  return new Promise((resolve, reject) => {
    const check = (remaining) => {
      const request = http.get("http://127.0.0.1:8000/health", (response) => {
        response.resume();
        response.statusCode === 200 ? resolve() : retry(remaining);
      });
      request.on("error", () => retry(remaining));
    };
    const retry = (remaining) => remaining ? setTimeout(() => check(remaining - 1), 100) : reject(new Error("Backend local não iniciou."));
    check(retries);
  });
}

async function createWindow() {
  backend = startBackend(root);
  try {
    await waitForBackend();
    const window = new BrowserWindow({ width: 1440, height: 960, minWidth: 1100, minHeight: 720, show: !smoke, backgroundColor: "#121a20", webPreferences: { contextIsolation: true, nodeIntegration: false } });
    if (smoke) window.webContents.once("did-finish-load", async () => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (process.env.ELECTRON_CAPTURE_PATH) await fs.writeFile(process.env.ELECTRON_CAPTURE_PATH, (await window.capturePage()).toPNG());
      console.log("PASS: Electron loaded the local application."); app.quit();
    });
    await window.loadFile(path.join(root, "frontend", "dist", "index.html"));
  } catch (error) {
    await dialog.showErrorBox("Agents Room", error.message);
    app.quit();
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => { if (backend && !backend.killed) backend.kill(); });
