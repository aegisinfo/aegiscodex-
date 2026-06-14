"use strict";

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const os   = require("os");
const fs   = require("fs");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }

const CONFIG_PATH = path.join(os.homedir(), ".aegiscode", "config.json");
const AEGIS_BIN   = path.join(__dirname, "..", "dist", "main.js");

// ── Platform-aware icon ───────────────────────────────────────────────────────
const ICONS_DIR = path.join(__dirname, "icons");
function getIcon() {
  if (process.platform === "darwin") return path.join(ICONS_DIR, "icon.icns");
  if (process.platform === "win32")  return path.join(ICONS_DIR, "icon.ico");
  return path.join(ICONS_DIR, "icon.png");
}

// ── Node binary detection ─────────────────────────────────────────────────────
function findNode() {
  // Prefer the node that ships alongside electron (nvm / volta / etc.)
  const candidates = process.platform === "win32"
    ? ["node.exe"]
    : ["node", "/usr/local/bin/node", "/usr/bin/node", `${os.homedir()}/.local/node22/bin/node`];

  for (const c of candidates) {
    try {
      require("child_process").execFileSync(c, ["--version"], { stdio: "ignore" });
      return c;
    } catch {}
  }
  return null;
}

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); }
  catch { return {}; }
}

function saveConfig(data) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

// ── .env file (API keys) ──────────────────────────────────────────────────────
const ENV_PATH = path.join(os.homedir(), ".aegiscode", ".env");

// Keys we expose in the Settings UI
const KNOWN_ENV_KEYS = [
  "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "DEEPSEEK_API_KEY",
  "GROQ_API_KEY", "GEMINI_API_KEY", "OLLAMA_BASE_URL",
];

function parseEnvFile(filePath) {
  try {
    return Object.fromEntries(
      fs.readFileSync(filePath, "utf8").split("\n")
        .map(l => {
          const eq = l.indexOf("=");
          if (eq < 0 || l.trim().startsWith("#")) return null;
          const k = l.slice(0, eq).trim();
          const v = l.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
          return k && v && !v.startsWith("YOUR_") ? [k, v] : null;
        })
        .filter(Boolean)
    );
  } catch { return {}; }
}

function loadEnv() {
  const storedPath  = ENV_PATH;
  const projectPath = path.join(__dirname, "..", ".env");

  const stored  = parseEnvFile(storedPath);
  const project = parseEnvFile(projectPath);

  console.log("[aegis-gui] loadEnv stored keys:", Object.keys(stored));
  console.log("[aegis-gui] loadEnv project keys:", Object.keys(project));

  const merged = {};
  for (const key of KNOWN_ENV_KEYS) {
    merged[key] = stored[key] || project[key] || process.env[key] || "";
  }
  // Carry over non-provider keys (e.g. AEGIS_MEMORY_TOKEN) without overwriting above
  for (const [k, v] of Object.entries({ ...project, ...stored })) {
    if (!(k in merged)) merged[k] = v;
  }

  console.log("[aegis-gui] loadEnv result:", Object.fromEntries(
    Object.entries(merged).map(([k, v]) => [k, v ? v.slice(0, 6) + "…" : "(empty)"])
  ));

  return merged;
}

function saveEnv(data) {
  // Read existing file to preserve any non-provider keys
  const existing = parseEnvFile(ENV_PATH);
  const updated  = { ...existing, ...data };

  const lines = Object.entries(updated)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `${k}=${v.trim()}`);

  fs.mkdirSync(path.dirname(ENV_PATH), { recursive: true });
  fs.writeFileSync(ENV_PATH, lines.join("\n") + "\n");
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

// ── Memory subscription ────────────────────────────────────────────────────────
const TOKEN_PATH = path.join(os.homedir(), ".aegiscode", "memory.token");
const STRIPE_URL = "https://buy.stripe.com/14A4gB4J53vxcaV74S9R601";
const VERIFY_URL = "https://aegiscloud.org/api/verify-token";

function getMemoryStatus() {
  const cfg        = loadConfig();
  const mem        = cfg?.memory ?? {};
  const tokenExists = fs.existsSync(TOKEN_PATH);
  const subscribed = mem.subscribed === true || tokenExists;
  return {
    subscribed,
    email:       mem.verifiedEmail || null,
    plan:        mem.plan || null,
    activatedAt: mem.activatedAt || null,
    stripeUrl:   STRIPE_URL,
  };
}

async function activateMemory(apiKey) {
  if (!apiKey || apiKey.length < 16) {
    return { ok: false, error: "Invalid key — paste the full API key from your activation email" };
  }

  const key = apiKey.trim();

  try {
    fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
    fs.writeFileSync(TOKEN_PATH, key);
  } catch {}

  let email     = "stripe-user";
  let plan      = "semantic-memory";
  let expiresAt = null;

  try {
    const headers = { "Content-Type": "application/json", "X-API-Key": key };
    const res     = await fetch(VERIFY_URL, { method: "POST", headers, body: JSON.stringify({ token: key }) });
    const result  = await res.json();
    if (result.valid) {
      email     = result.email     || email;
      plan      = result.plan      || plan;
      expiresAt = result.expiresAt || null;
    }
  } catch { /* offline activation */ }

  try {
    const cfg = loadConfig();
    cfg.aegiscloud = {
      ...(cfg.aegiscloud || {}),
      api_key:           key,
      syncConversations: true,
    };
    cfg.memory = {
      ...(cfg.memory || {}),
      subscribed:    true,
      token:         key,
      activatedAt:   new Date().toISOString(),
      verifiedEmail: email,
      plan,
      expiresAt,
    };
    saveConfig(cfg);
  } catch (e) {
    return { ok: false, error: "Failed to save config: " + e.message };
  }

  return { ok: true, email, plan };
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
let mainWindow  = null;
let ptyProcess  = null;
let shellProcess = null;

function spawnShell(cols, rows) {
  if (shellProcess) { shellProcess.kill(); shellProcess = null; }

  let pty;
  try { pty = require("node-pty"); } catch { return false; }

  const shell = process.platform === "win32"
    ? "cmd.exe"
    : (process.env.SHELL || "/bin/bash");

  shellProcess = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols: cols || 120,
    rows: rows || 10,
    cwd:  os.homedir(),
    env:  { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor", FORCE_COLOR: "3" },
  });

  shellProcess.onData(data  => mainWindow?.webContents.send("shell-data", data));
  shellProcess.onExit(() => { mainWindow?.webContents.send("shell-exit"); shellProcess = null; });

  return true;
}

function createWindow() {
  const icon = getIcon();

  mainWindow = new BrowserWindow({
    width:           1100,
    height:          700,
    minWidth:        800,
    minHeight:       520,
    title:           "AEGIS Code",
    backgroundColor: "#04060a",
    // hiddenInset gives the macOS traffic-light overlay; default works on Win/Linux
    titleBarStyle:   process.platform === "darwin" ? "hiddenInset" : "default",
    icon,
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

  // Ctrl+Shift+I → DevTools
  mainWindow.webContents.on("before-input-event", (_, input) => {
    if (input.control && input.shift && input.key === "I") {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on("closed", () => {
    ptyProcess?.kill();
    shellProcess?.kill();
    ptyProcess = shellProcess = null;
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
  try { pty = require("node-pty"); } catch {
    mainWindow?.webContents.send("pty-data", "\r\nnode-pty not available — run: cd gui && npm install\r\n");
    return false;
  }

  const nodeBin = findNode();
  if (!nodeBin) {
    mainWindow?.webContents.send("pty-data", "\r\nNode.js not found in PATH.\r\nInstall Node.js >= 22 from https://nodejs.org\r\n");
    return false;
  }

  const args = ["--no-deprecation", AEGIS_BIN];
  if (resumeId) args.push("--resume", resumeId);

  // Merge env vars from .env files so CLI gets API keys without reading its own .env
  const loaded = loadEnv();
  const env = {
    ...process.env,
    ...loaded,
    TERM:       "xterm-256color",
    COLORTERM:  "truecolor",
    FORCE_COLOR:"3",
  };
  // Remove empty values — don't override shell-set keys with empty strings
  for (const k of Object.keys(env)) { if (env[k] === "") delete env[k]; }

  // Spawn from project root so dotenvConfig({ path: resolve(cwd, '.env') }) in main.tsx
  // finds the right .env file — same as running aegiscode from its own directory.
  const aegisRoot = path.join(__dirname, "..");

  ptyProcess = pty.spawn(nodeBin, args, {
    name: "xterm-256color",
    cols: cols || 120,
    rows: rows || 36,
    cwd:  aegisRoot,
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
ipcMain.handle("get-memory-status",  ()           => getMemoryStatus());
ipcMain.handle("activate-memory",    (_, token)   => activateMemory(token));

ipcMain.handle("get-version",  ()        => require("./package.json").version);
ipcMain.handle("get-env",      ()        => loadEnv());
ipcMain.handle("save-env",     (_, d)    => { saveEnv(d); return true; });

ipcMain.handle("get-config",   ()        => loadConfig());
ipcMain.handle("save-config",  (_, d)    => { saveConfig(d); return true; });
ipcMain.handle("get-history",  ()        => loadHistory());
ipcMain.handle("get-cloud",    ()        => getCloudConfig());
ipcMain.handle("open-external",(_, url)  => shell.openExternal(url));

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

ipcMain.handle("shell-spawn",  (_, { cols, rows }) => {
  const ok = spawnShell(cols, rows);
  return { ok, cwd: os.homedir() };
});
ipcMain.handle("shell-write",  (_, data)           => { if (shellProcess) shellProcess.write(data); });
ipcMain.handle("shell-resize", (_, { cols, rows }) => { if (shellProcess) shellProcess.resize(cols, rows); });
ipcMain.handle("shell-kill",   ()                  => { shellProcess?.kill(); shellProcess = null; });

// ── Config file watcher (model change detection) ──────────────────────────────
let configWatcher = null;
function watchConfig() {
  try {
    configWatcher?.close();
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) return;
    configWatcher = fs.watch(CONFIG_PATH, (eventType) => {
      if (eventType === 'change') {
        try {
          const cfg = loadConfig();
          mainWindow?.webContents.send("config-changed", cfg);
        } catch {}
      }
    });
  } catch {}
}
app.on("ready", () => watchConfig());
app.on("window-all-closed", () => { configWatcher?.close(); });

// ── Boot ──────────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  watchConfig();
  // Linux taskbar icon must be set explicitly
  if (process.platform === "linux") {
    try { app.setIcon(path.join(ICONS_DIR, "icon.png")); } catch {}
  }
});

app.on("second-instance", () => { mainWindow?.show(); mainWindow?.focus(); });
// On macOS, keep app alive when all windows are closed (click dock icon to reopen)
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (!mainWindow) createWindow(); });
