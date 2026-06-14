"use strict";

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById("tab-" + tab)?.classList.add("active");
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add("active");

  if (tab === "history") loadHistory();
  if (tab === "cloud")   loadCloud();
  if (tab === "settings") loadSettings();

  // Re-fit terminal when switching back
  if (tab === "terminal" && fitAddon) {
    setTimeout(() => { fitAddon.fit(); }, 50);
  }
}

// ── xterm.js setup ────────────────────────────────────────────────────────────
let term     = null;
let fitAddon = null;
let lastResumeId = null;

function initTerminal() {
  const container = document.getElementById("xterm-container");

  term = new Terminal({
    fontFamily: '"Cascadia Code","Fira Code","JetBrains Mono","Consolas",monospace',
    fontSize:   13,
    lineHeight: 1.25,
    cursorBlink:true,
    cursorStyle:"bar",
    theme: {
      background:    "#000000",
      foreground:    "#c8d8e8",
      cursor:        "#00c8b4",
      cursorAccent:  "#000000",
      selectionBackground: "rgba(0,200,180,.25)",
      black:   "#04060a",
      red:     "#e04444",
      green:   "#1ab87a",
      yellow:  "#e89020",
      blue:    "#5a7fd4",
      magenta: "#a06ad4",
      cyan:    "#00c8b4",
      white:   "#c8d8e8",
      brightBlack:   "#2e4055",
      brightRed:     "#f06060",
      brightGreen:   "#20d890",
      brightYellow:  "#f0a030",
      brightBlue:    "#7a9fe4",
      brightMagenta: "#c090e0",
      brightCyan:    "#20e0d0",
      brightWhite:   "#e8f0f8",
    },
    allowTransparency: true,
    scrollback: 5000,
    rightClickSelectsWord: true,
  });

  fitAddon = new FitAddon.FitAddon();
  const linkAddon = new WebLinksAddon.WebLinksAddon((_, url) => AEGIS.openExternal(url));

  term.loadAddon(fitAddon);
  term.loadAddon(linkAddon);
  term.open(container);
  fitAddon.fit();

  // Input → PTY
  term.onData(data => AEGIS.ptyWrite(data));

  // PTY output → terminal
  AEGIS.onPtyData(data => term.write(data));

  // PTY exit
  AEGIS.onPtyExit(code => {
    setPtyStatus(false);
    term.writeln(`\r\n\x1b[2m[process exited with code ${code}]\x1b[0m`);
    term.writeln(`\x1b[2m[press any key or click ↺ New session to restart]\x1b[0m`);
  });

  // Resize observer
  const ro = new ResizeObserver(() => {
    if (!fitAddon) return;
    try {
      fitAddon.fit();
      AEGIS.ptyResize({ cols: term.cols, rows: term.rows });
    } catch(_) {}
  });
  ro.observe(container);

  // Keyboard: any key after exit restarts
  term.onKey(({ domEvent }) => {
    const dot = document.getElementById("pty-dot");
    if (!dot.classList.contains("on")) {
      spawnSession();
    }
  });

  spawnSession();
}

// ── PTY control ───────────────────────────────────────────────────────────────
function setPtyStatus(on, label) {
  const dot  = document.getElementById("pty-dot");
  const text = document.getElementById("pty-status");
  dot.classList.toggle("on", on);
  text.textContent = label || (on ? "running" : "idle");
}

async function spawnSession(resumeId) {
  setPtyStatus(false, "starting…");
  lastResumeId = resumeId || null;
  const ok = await AEGIS.ptySpawn({ cols: term.cols, rows: term.rows, resumeId });
  if (ok) {
    setPtyStatus(true, "running");
  } else {
    term.writeln("\x1b[31mFailed to start aegiscode. Is dist/main.js built?\x1b[0m");
    setPtyStatus(false, "error");
  }
}

function restartPty() {
  AEGIS.ptyKill();
  term.clear();
  spawnSession();
}

function resumePty() {
  if (lastResumeId) {
    AEGIS.ptyKill();
    term.clear();
    spawnSession(lastResumeId);
  } else {
    loadHistoryAndResume();
  }
}

async function loadHistoryAndResume() {
  const items = await AEGIS.getHistory();
  if (!items.length) { term.writeln("\x1b[33mNo sessions found.\x1b[0m"); return; }
  const first = items[0];
  AEGIS.ptyKill();
  term.clear();
  spawnSession(first.id);
}

function killPty() {
  AEGIS.ptyKill();
  setPtyStatus(false, "killed");
}

// ── History ───────────────────────────────────────────────────────────────────
async function loadHistory() {
  const el    = document.getElementById("history-list");
  const items = await AEGIS.getHistory();

  if (!items.length) {
    el.innerHTML = `<div class="history-empty">⌁<br><br>No sessions yet.<br>Start a conversation in the Terminal tab.</div>`;
    return;
  }

  el.innerHTML = items.map(s => `
    <div class="history-item" onclick="openSession('${s.id}')">
      <span class="history-icon">◷</span>
      <div class="history-info">
        <div class="history-title">${escHtml(s.title || s.id)}</div>
        <div class="history-id">${s.id.slice(0, 16)}…</div>
      </div>
      <span class="history-resume">Resume ↗</span>
    </div>
  `).join("");
}

function openSession(id) {
  lastResumeId = id;
  switchTab("terminal");
  AEGIS.ptyKill();
  term.clear();
  spawnSession(id);
}

// ── Cloud ─────────────────────────────────────────────────────────────────────
async function loadCloud() {
  const el    = document.getElementById("cloud-content");
  const cloud = await AEGIS.getCloud();

  const dotColor = cloud.hasKey && cloud.syncOn ? "#1ab87a" : "#2e4055";
  const statusLabel = cloud.hasKey
    ? (cloud.syncOn ? "Sync active" : "Sync paused")
    : "Not connected";

  el.innerHTML = `
    <div class="cloud-status">
      <div class="cloud-dot" style="background:${dotColor};box-shadow:0 0 6px ${cloud.hasKey && cloud.syncOn ? dotColor : 'transparent'}"></div>
      <span class="cloud-label">${statusLabel}</span>
      <span class="cloud-sub">aegiscloud.org</span>
    </div>

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:20px">
      <div class="info-row">
        <span class="info-key">API Key</span>
        <span class="info-val">${cloud.maskedKey || "—"}</span>
      </div>
      <div class="info-row">
        <span class="info-key">Auto-upload</span>
        <span class="info-val" style="color:${cloud.syncOn && cloud.hasKey ? 'var(--green)' : 'var(--text3)'}">
          ${cloud.syncOn && cloud.hasKey ? "✓ enabled" : "✗ disabled"}
        </span>
      </div>
      <div class="info-row">
        <span class="info-key">Endpoint</span>
        <span class="info-val">aegiscloud.org/api/conversations</span>
      </div>
    </div>

    <div class="cloud-actions">
      ${!cloud.hasKey
        ? `<button class="btn btn-primary" onclick="AEGIS.openExternal('https://aegiscloud.org')">Get API key ↗</button>`
        : `
          <button class="btn" onclick="sendCloudCmd('/cloud activate')">Activate sync</button>
          <button class="btn" onclick="sendCloudCmd('/cloud deactivate')">Pause sync</button>
        `}
      <button class="btn" onclick="switchTab('settings')">Settings ⚙</button>
    </div>
  `;
}

function sendCloudCmd(cmd) {
  // Type the command into the terminal
  switchTab("terminal");
  AEGIS.ptyWrite(cmd + "\n");
}

// ── Settings ──────────────────────────────────────────────────────────────────
async function loadSettings() {
  const cfg = await AEGIS.getConfig();
  const model = cfg?.models?.find(m => m.id === cfg?.currentModelId) || cfg?.default || {};

  document.getElementById("s-apikey").value   = model.apiKey  || "";
  document.getElementById("s-model").value    = model.model   || "";
  document.getElementById("s-baseurl").value  = model.baseURL || "";
  document.getElementById("s-cloudkey").value = cfg?.aegiscloud?.api_key || "";
  document.getElementById("s-cloudsync").value = cfg?.aegiscloud?.syncConversations === false ? "off" : "on";
}

async function saveSettings() {
  const cfg = await AEGIS.getConfig();

  // Update model config
  const apiKey  = document.getElementById("s-apikey").value.trim();
  const model   = document.getElementById("s-model").value.trim();
  const baseURL = document.getElementById("s-baseurl").value.trim();
  const cloudKey = document.getElementById("s-cloudkey").value.trim();
  const syncOn   = document.getElementById("s-cloudsync").value === "on";

  // Patch into existing config structure
  if (!cfg.models) cfg.models = [];
  const existing = cfg.models.find(m => m.id === cfg.currentModelId);
  if (existing) {
    if (apiKey)  existing.apiKey  = apiKey;
    if (model)   existing.model   = model;
    if (baseURL) existing.baseURL = baseURL;
  } else if (apiKey || model) {
    const id = "default";
    cfg.models.push({ id, apiKey, model, baseURL });
    cfg.currentModelId = id;
  }

  if (!cfg.default) cfg.default = {};
  if (apiKey)  cfg.default.apiKey  = apiKey;
  if (model)   cfg.default.model   = model;
  if (baseURL) cfg.default.baseURL = baseURL;

  if (cloudKey || cfg.aegiscloud) {
    cfg.aegiscloud = {
      ...cfg.aegiscloud,
      ...(cloudKey ? { api_key: cloudKey } : {}),
      syncConversations: syncOn,
    };
  }

  await AEGIS.saveConfig(cfg);

  const note = document.getElementById("save-note");
  note.style.display = "inline";
  setTimeout(() => { note.style.display = "none"; }, 2000);

  // Update terminal model display
  loadTerminalModel(cfg);
}

function loadTerminalModel(cfg) {
  const model = cfg?.models?.find(m => m.id === cfg?.currentModelId)?.model
    || cfg?.default?.model
    || "";
  const el = document.getElementById("terminal-model");
  if (el && model) el.textContent = model;
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function escHtml(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  initTerminal();

  // Load config for sidebar version + model display
  const cfg = await AEGIS.getConfig();
  loadTerminalModel(cfg);

  // Show version in sidebar
  const verEl = document.getElementById("nav-version");
  if (verEl) verEl.textContent = "v1.0.0";
});
