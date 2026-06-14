"use strict";

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const os   = require("os");
const fs   = require("fs");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }

const CONFIG_PATH = path.join(os.homedir(), ".aegiscode", "config.json");
const AEGIS_BIN   = path.join(__dirname, "..", "dist", "main.js");

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); }
  catch { return {}; }
}

function saveConfig(data) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

// ── Memory ─────────────────────────────────────────────────────────────────────
const MEMORY_PATH = path.join(os.homedir(), ".aegiscode", "memory", "shared.json");

function loadMemoryEntries() {
  try { return JSON.parse(fs.readFileSync(MEMORY_PATH, "utf8")); }
  catch { return []; }
}

function getMemoryStats() {
  const entries = loadMemoryEntries();
  const sessions = new Set(entries.map(e => e.session).filter(Boolean)).size;
  const sources  = [...new Set(entries.map(e => e.source).filter(Boolean))];
  const byRole   = { user: 0, assistant: 0, other: 0 };
  entries.forEach(e => {
    const tag = (e.tags || []).find(t => t === "user" || t === "assistant");
    if (tag === "user") byRole.user++;
    else if (tag === "assistant") byRole.assistant++;
    else byRole.other++;
  });
  return { total: entries.length, sessions, sources, byRole };
}

function searchMemory(query, limit = 50) {
  const entries = loadMemoryEntries();
  if (!query) return entries.slice(-limit).reverse();
  const q = query.toLowerCase();
  return entries
    .filter(e => (e.content || "").toLowerCase().includes(q) ||
                 (e.tags  || []).some(t => t.toLowerCase().includes(q)) ||
                 (e.session || "").toLowerCase().includes(q))
    .slice(-limit)
    .reverse();
}

function clearMemory() {
  try {
    fs.writeFileSync(MEMORY_PATH, "[]");
    return true;
  } catch { return false; }
}

// ── Session history ────────────────────────────────────────────────────────────
function loadHistory() {
  try {
    const dir = path.join(os.homedir(), ".aegiscode", "sessions");
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.endsWith(".json"))
      .map(f => {
        try {
          const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
          return { id: f.replace(".json",""), title: d.title || d.id || f, ts: d.createdAt || d.timestamp || "" };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a,b) => b.ts.localeCompare(a.ts))
      .slice(0, 50);
  } catch { return []; }
}

// ── Cloud sync status ──────────────────────────────────────────────────────────
function getCloudConfig() {
  const cfg = loadConfig();
  return {
    hasKey: !!cfg?.aegiscloud?.api_key,
    syncOn: cfg?.aegiscloud?.syncConversations !== false,
    maskedKey: cfg?.aegiscloud?.api_key
      ? cfg.aegiscloud.api_key.slice(0,6) + "..." + cfg.aegiscloud.api_key.slice(-4)
      : null,
  };
}

// ── Window ────────────────────────────────────────────────────────────────────
let mainWindow = null;
let ptyProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width:           1100,
    height:          700,
    minWidth:        800,
    minHeight:       520,
    title:           "AEGIS Code",
    backgroundColor: "#04060a",
    titleBarStyle:   "hiddenInset",
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      sandbox:          false,       // node-pty needs this off in preload
      preload:          path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file://")) { e.preventDefault(); shell.openExternal(url); }
  });

  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on("closed", () => {
    ptyProcess?.kill();
    ptyProcess = null;
    mainWindow = null;
  });
}

// ── PTY spawn ─────────────────────────────────────────────────────────────────
function spawnPty(cols, rows, resumeId) {
  if (ptyProcess) {
    ptyProcess.kill();
    ptyProcess = null;
  }

  let pty;
  try { pty = require("node-pty"); } catch { return false; }

  const args = ["--no-deprecation", AEGIS_BIN];
  if (resumeId) args.push("--resume", resumeId);

  const env = {
    ...process.env,
    TERM:       "xterm-256color",
    COLORTERM:  "truecolor",
    FORCE_COLOR:"3",
  };

  ptyProcess = pty.spawn("node", args, {
    name: "xterm-256color",
    cols: cols || 120,
    rows: rows || 36,
    cwd:  os.homedir(),
    env,
  });

  ptyProcess.onData(data => {
    mainWindow?.webContents.send("pty-data", data);
  });

  ptyProcess.onExit(({ exitCode }) => {
    mainWindow?.webContents.send("pty-exit", exitCode);
    ptyProcess = null;
  });

  return true;
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.handle("get-memory-stats",   ()           => getMemoryStats());
ipcMain.handle("search-memory",      (_, q)       => searchMemory(q));
ipcMain.handle("clear-memory",       ()           => clearMemory());

ipcMain.handle("get-config",    ()        => loadConfig());
ipcMain.handle("save-config",   (_, d)    => { saveConfig(d); return true; });
ipcMain.handle("get-history",   ()        => loadHistory());
ipcMain.handle("get-cloud",     ()        => getCloudConfig());
ipcMain.handle("open-external", (_, url)  => shell.openExternal(url));

ipcMain.handle("pty-spawn", (_, { cols, rows, resumeId }) => {
  return spawnPty(cols, rows, resumeId);
});

ipcMain.handle("pty-write", (_, data) => {
  if (ptyProcess) ptyProcess.write(data);
});

ipcMain.handle("pty-resize", (_, { cols, rows }) => {
  if (ptyProcess) ptyProcess.resize(cols, rows);
});

ipcMain.handle("pty-kill", () => {
  ptyProcess?.kill();
  ptyProcess = null;
});

// ── Boot ──────────────────────────────────────────────────────────────────────
app.whenReady().then(createWindow);

app.on("second-instance", () => { mainWindow?.show(); mainWindow?.focus(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
