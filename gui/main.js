"use strict";

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const os   = require("os");
const fs   = require("fs");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }

const CONFIG_PATH = path.join(os.homedir(), ".aegiscode", "config.json");

const AEGIS_BIN  = app.isPackaged
  ? path.join(process.resourcesPath, "dist", "main.js")
  : path.join(__dirname, "..", "dist", "main.js");
const AEGIS_ROOT = app.isPackaged ? os.homedir() : path.join(__dirname, "..");

// ── Platform-aware icon ───────────────────────────────────────────────────────
const ICONS_DIR = app.isPackaged
  ? path.join(process.resourcesPath, "icons")
  : path.join(__dirname, "icons");
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
  "AEGIS_MEMORY_TOKEN",
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
  const projectPath = app.isPackaged ? null : path.join(__dirname, "..", ".env");

  const stored  = parseEnvFile(storedPath);
  const project = parseEnvFile(projectPath);

  const merged = {};
  for (const key of KNOWN_ENV_KEYS) {
    merged[key] = stored[key] || project[key] || process.env[key] || "";
  }
  // Carry over non-provider keys (e.g. AEGIS_MEMORY_TOKEN) without overwriting above
  for (const [k, v] of Object.entries({ ...project, ...stored })) {
    if (!(k in merged)) merged[k] = v;
  }

  return merged;
}

// ── Memory subscription ────────────────────────────────────────────────────────
const TOKEN_PATH = path.join(os.homedir(), ".aegiscode", "memory.token");

function saveEnv(data) {
  // Read existing file to preserve any non-provider keys
  const existing = parseEnvFile(ENV_PATH);
  const updated  = { ...existing, ...data };

  const lines = Object.entries(updated)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `${k}=${v.trim()}`);

  fs.mkdirSync(path.dirname(ENV_PATH), { recursive: true });
  fs.writeFileSync(ENV_PATH, lines.join("\n") + "\n");

  // Keep memory.token in sync with AEGIS_MEMORY_TOKEN from .env
  const token = updated["AEGIS_MEMORY_TOKEN"];
  if (token && token.trim()) {
    fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
    fs.writeFileSync(TOKEN_PATH, token.trim());
  } else if (fs.existsSync(TOKEN_PATH)) {
    fs.unlinkSync(TOKEN_PATH);
  }
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
// CLI saves sessions to ~/.aegis/projects/{escaped-cwd}/{sessionId}.jsonl
// We scan all project subdirectories and read the first user message as the title.
function loadHistory() {
  try {
    const aegisRoot = path.join(os.homedir(), ".aegis", "projects");
    if (!fs.existsSync(aegisRoot)) return [];

    const allSessions = [];

    let projectDirs;
    try {
      projectDirs = fs.readdirSync(aegisRoot, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => path.join(aegisRoot, d.name));
    } catch { return []; }

    for (const projectDir of projectDirs) {
      let files;
      try { files = fs.readdirSync(projectDir).filter(f => f.endsWith(".jsonl")); }
      catch { continue; }

      for (const file of files) {
        try {
          const filePath = path.join(projectDir, file);
          const stat    = fs.statSync(filePath);
          const sessionId = file.replace(".jsonl", "");
          let title = sessionId.slice(0, 24) + "…";
          let ts    = stat.mtime.toISOString();

          // Read first 4 KB to find the first user message for the title
          try {
            const fd  = fs.openSync(filePath, "r");
            const buf = Buffer.alloc(4096);
            const n   = fs.readSync(fd, buf, 0, 4096, 0);
            fs.closeSync(fd);
            for (const line of buf.toString("utf8", 0, n).split("\n")) {
              if (!line.trim()) continue;
              try {
                const entry = JSON.parse(line);
                if (entry.type === "user" && entry.message?.content) {
                  const c = typeof entry.message.content === "string"
                    ? entry.message.content : JSON.stringify(entry.message.content);
                  if (c.trim()) {
                    title = c.trim().slice(0, 60) + (c.length > 60 ? "…" : "");
                    ts = entry.timestamp || ts;
                    break;
                  }
                }
              } catch {}
            }
          } catch {}

          allSessions.push({ id: sessionId, title, ts });
        } catch {}
      }
    }

    return allSessions.sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 50);
  } catch { return []; }
}

// ── Kitty terminal support ─────────────────────────────────────────────────────
function findKittyBin() {
  const fs = require("fs");
  const { execFileSync } = require("child_process");
  try {
    const bin = execFileSync("which", ["kitty"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (bin) return bin;
  } catch {}
  // Official installer drops kitty here on Linux + macOS
  const localKitty = path.join(os.homedir(), ".local", "kitty.app", "bin", "kitty");
  if (fs.existsSync(localKitty)) return localKitty;
  if (process.platform === "win32") {
    const winKitty = path.join(os.homedir(), "AppData", "Local", "Programs", "kitty", "kitty.exe");
    if (fs.existsSync(winKitty)) return winKitty;
  }
  return null;
}

function isKittyAvailable() {
  return !!findKittyBin();
}

async function installKitty(sender) {
  const { exec } = require("child_process");
  const send = (msg) => { try { sender.send("kitty-install-progress", String(msg).trim()); } catch {} };

  return new Promise((resolve, reject) => {
    let cmd;
    if (process.platform === "win32") {
      send("Installing Kitty via winget…");
      cmd = "winget install --id kovidgoyal.kitty --silent --accept-package-agreements --accept-source-agreements";
    } else {
      send("Downloading Kitty…");
      cmd = "curl -fsSL https://sw.kovidgoyal.net/kitty/installer.sh | sh /dev/stdin launch=n";
    }
    const child = exec(cmd, { env: { ...process.env, HOME: os.homedir() } });
    child.stdout?.on("data", d => send(d));
    child.stderr?.on("data", d => send(d));
    child.on("close", () => {
      const bin = findKittyBin();
      if (bin) resolve(bin);
      else reject(new Error("Kitty not found after install"));
    });
    child.on("error", reject);
  });
}

function spawnKitty(resumeId) {
  const kittyBin = findKittyBin();
  if (!kittyBin) {
    mainWindow?.webContents.send("pty-data", "\r\n\x1b[31mKitty not found — install it or use built-in terminal.\x1b[0m\r\n");
    return;
  }
  const nodeBin = findNode();
  if (!nodeBin) {
    mainWindow?.webContents.send("pty-data", "\r\n\x1b[31mNode.js not found — install Node.js >= 22.\x1b[0m\r\n");
    return;
  }
  const args = ["--no-deprecation", AEGIS_BIN];
  if (resumeId) args.push("--resume", resumeId);

  const loaded = loadEnv();
  const env = {
    ...process.env,
    ...loaded,
    TERM: "xterm-kitty",
    COLORTERM: "truecolor",
    FORCE_COLOR: "3",
  };
  for (const k of Object.keys(env)) { if (env[k] === "") delete env[k]; }
  if (process.platform === "linux" && !env.DISPLAY) env.DISPLAY = process.env.DISPLAY || ":0";

  const { execFile } = require("child_process");
  const child = execFile(kittyBin, ["--", nodeBin, ...args], { cwd: AEGIS_ROOT, env, detached: true, stdio: "ignore" });
  child.unref();

  child.on("error", (err) => {
    mainWindow?.webContents.send("kitty-error", `Kitty failed to launch: ${err.message}`);
  });
  child.on("exit", (code, sig) => {
    if (code !== 0 || sig) {
      const reason = sig ? `signal ${sig}` : `exit code ${code}`;
      mainWindow?.webContents.send("kitty-error", `Kitty terminated early (${reason})`);
    }
  });
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

function ensureAegisWrapper() {
  const nodeBin = findNode() || "node";
  let absNode = nodeBin;
  try { absNode = require("child_process").execFileSync("which", [nodeBin], { encoding: "utf8" }).trim() || nodeBin; } catch {}

  const aegisBin  = AEGIS_BIN;
  const wrapperSh = `#!/bin/sh\nexec "${absNode}" --no-deprecation "${aegisBin}" "$@"\n`;

  // Write to both ~/.local/bin and ~/.aegiscode/bin
  const dirs = [
    path.join(os.homedir(), ".local", "bin"),
    path.join(os.homedir(), ".aegiscode", "bin"),
  ];
  for (const dir of dirs) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "aegis-cli"), wrapperSh);
      fs.chmodSync(path.join(dir, "aegis-cli"), 0o755);
    } catch (e) { /* skip unwritable dirs */ }
  }
}

// ── Shell (lower terminal) ────────────────────────────────────────────────────
// Startar en normal interaktiv shell i användarens hemkatalog.
// aegis-cli finns via ~/.local/bin/aegis-cli wrapper.

function spawnShell(cols, rows) {
  if (shellProcess) { shellProcess.kill(); shellProcess = null; }

  let pty;
  try { pty = require("@homebridge/node-pty-prebuilt-multiarch"); } catch { return null; }

  const isWin    = process.platform === "win32";
  const shellExe = isWin ? "cmd.exe" : (process.env.SHELL || "/bin/bash");

  ensureAegisWrapper();

  const env = { ...process.env, TERM: "xterm-256color" };

  // Utöka PATH med wrapper-kataloger
  const extraPath = [
    path.join(os.homedir(), ".local", "bin"),
    path.join(os.homedir(), ".aegiscode", "bin"),
  ].filter(fs.existsSync).join(":");
  if (extraPath) env.PATH = `${extraPath}:${env.PATH}`;

  // Kör i hemkatalog (som en vanlig terminal)
  const home = os.homedir();

  // Explicit -i flag för att säkerställa interaktiv shell
  const shellArgs = isWin ? [] : ["-i"];

  shellProcess = pty.spawn(shellExe, shellArgs, {
    name: "xterm-256color",
    cols: cols || 120,
    rows: rows || 10,
    cwd:  home,
    env,
  });

  shellProcess.onData(data  => mainWindow?.webContents.send("shell-data", data));
  shellProcess.onExit(() => { mainWindow?.webContents.send("shell-exit"); shellProcess = null; });

  return home;
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
    backgroundThrottling: false,   // hindrar throttling vid terminalströmning
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
  try { pty = require("@homebridge/node-pty-prebuilt-multiarch"); } catch {
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
  const aegisRoot = AEGIS_ROOT;

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

ipcMain.handle("verify-memory-token", async (_, token) => {
  if (!token || token.trim().length < 10) {
    return { ok: false, error: "Token too short — paste the full token from your activation email" };
  }
  const key = token.trim();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(VERIFY_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": key },
      body:    JSON.stringify({ token: key }),
      signal:  controller.signal,
    });
    clearTimeout(timer);
    const result = await res.json();
    if (!result.valid) {
      return { ok: false, error: result.error || "Token not recognized — check your activation email" };
    }
    return { ok: true, email: result.email || null, plan: result.plan || null };
  } catch (e) {
    if (e.name === "AbortError") {
      return { ok: false, error: "Could not reach aegiscloud.org — check your connection" };
    }
    return { ok: false, error: "Verification failed — check your connection and try again" };
  }
});

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

ipcMain.handle("kitty-available", ()               => isKittyAvailable());
ipcMain.handle("kitty-spawn",    (_, opts = {})    => {
  try { spawnKitty(opts?.resumeId); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle("kitty-install",  async (event)     => {
  try { const bin = await installKitty(event.sender); return { success: true, bin }; }
  catch (e) { return { success: false, error: e.message }; }
});

// ── Ollama support ────────────────────────────────────────────────────────────
function isOllamaBinaryAvailable() {
  const { execFileSync } = require("child_process");
  try { execFileSync("which", ["ollama"], { stdio: "ignore" }); return true; } catch {}
  try { execFileSync("ollama", ["--version"], { stdio: "ignore" }); return true; } catch {}
  for (const p of ["/usr/local/bin/ollama", "/usr/bin/ollama", path.join(os.homedir(), ".local", "bin", "ollama")]) {
    if (fs.existsSync(p)) return true;
  }
  return false;
}

async function isOllamaRunning() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch("http://localhost:11434/api/tags", { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch { return false; }
}

async function installOllama(sender) {
  const { exec } = require("child_process");
  const send = (msg) => { try { sender.send("ollama-install-progress", String(msg).trim()); } catch {} };

  if (isOllamaBinaryAvailable()) {
    send("Starting Ollama server…");
    return { success: true, alreadyInstalled: true };
  }

  return new Promise((resolve) => {
    let cmd;
    if (process.platform === "win32") {
      send("Installing Ollama via winget…");
      cmd = "winget install --id Ollama.Ollama --silent --accept-package-agreements --accept-source-agreements";
    } else {
      send("Downloading Ollama…");
      cmd = "curl -fsSL https://ollama.com/install.sh | sh";
    }
    const child = exec(cmd, { env: { ...process.env, HOME: os.homedir() } });
    child.stdout?.on("data", d => send(d));
    child.stderr?.on("data", d => send(d));
    child.on("close", (code) => {
      if (code === 0 || isOllamaBinaryAvailable()) { send("Ollama installed."); resolve({ success: true }); }
      else { send(`Install failed (exit ${code}).`); resolve({ success: false, error: `Exit ${code}` }); }
    });
    child.on("error", (e) => { send(`Error: ${e.message}`); resolve({ success: false, error: e.message }); });
  });
}

ipcMain.handle("ollama-available", ()         => isOllamaBinaryAvailable());
ipcMain.handle("ollama-running",   ()         => isOllamaRunning());
ipcMain.handle("ollama-install",   async (ev) => {
  try { return await installOllama(ev.sender); }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("shell-spawn",  (_, { cols, rows }) => {
  const cwd = spawnShell(cols, rows);
  return { ok: !!cwd, cwd: cwd || os.homedir() };
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
  ensureAegisWrapper();         // create aegis-cli wrappers for shell terminal
  // Linux taskbar icon must be set explicitly
  if (process.platform === "linux") {
    try { app.setIcon(path.join(ICONS_DIR, "icon.png")); } catch {}
  }
});

app.on("second-instance", () => { mainWindow?.show(); mainWindow?.focus(); });
// On macOS, keep app alive when all windows are closed (click dock icon to reopen)
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (!mainWindow) createWindow(); });
