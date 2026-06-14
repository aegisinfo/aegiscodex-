"use strict";

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById("tab-" + tab)?.classList.add("active");
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add("active");

  if (tab === "history") loadHistory();
  if (tab === "memory")  loadMemory();
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
const KEY_MAP = {
  anthropic: "ANTHROPIC_API_KEY",
  openai:    "OPENAI_API_KEY",
  deepseek:  "DEEPSEEK_API_KEY",
  groq:      "GROQ_API_KEY",
  gemini:    "GEMINI_API_KEY",
  ollama:    "OLLAMA_BASE_URL",
};

function setApiDot(id, value) {
  const dot = document.getElementById("dot-" + id);
  if (dot) dot.classList.toggle("set", !!value);
}

function toggleKeyVis(id, inputId) {
  const el = document.getElementById(inputId || "key-" + id);
  if (!el) return;
  const showing = el.type === "text";
  el.type = showing ? "password" : "text";
  const btn = el.nextElementSibling;
  if (btn && btn.classList.contains("api-row-toggle")) btn.textContent = showing ? "show" : "hide";
}

async function loadSettings() {
  const [env, cfg] = await Promise.all([AEGIS.getEnv(), AEGIS.getConfig()]);

  Object.entries(KEY_MAP).forEach(([id, envKey]) => {
    const el = document.getElementById("key-" + id);
    if (el) el.value = env[envKey] || "";
    setApiDot(id, env[envKey]);
  });

  const cloudKey = cfg?.aegiscloud?.api_key || "";
  const cloudEl  = document.getElementById("s-cloudkey");
  if (cloudEl) { cloudEl.value = cloudKey; setApiDot("cloudkey", cloudKey); }

  const syncEl = document.getElementById("s-cloudsync");
  if (syncEl) syncEl.value = cfg?.aegiscloud?.syncConversations === false ? "off" : "on";
}

async function saveSettings() {
  const [env, cfg] = await Promise.all([AEGIS.getEnv(), AEGIS.getConfig()]);

  // Write provider keys to .env
  Object.entries(KEY_MAP).forEach(([id, envKey]) => {
    const el  = document.getElementById("key-" + id);
    const val = el ? el.value.trim() : "";
    if (val) env[envKey] = val;
    else     delete env[envKey];
    setApiDot(id, val);
  });
  await AEGIS.saveEnv(env);

  // Write cloud config to config.json
  const cloudKey = (document.getElementById("s-cloudkey")?.value || "").trim();
  const syncOn   = document.getElementById("s-cloudsync")?.value === "on";
  setApiDot("cloudkey", cloudKey);

  if (cloudKey || cfg.aegiscloud) {
    cfg.aegiscloud = {
      ...(cfg.aegiscloud || {}),
      ...(cloudKey ? { api_key: cloudKey } : {}),
      syncConversations: syncOn,
    };
  }
  await AEGIS.saveConfig(cfg);

  const note = document.getElementById("save-note");
  note.style.display = "inline";
  setTimeout(() => { note.style.display = "none"; }, 2000);

  // Hide setup banner if any provider key is now set
  const anyKey = Object.keys(KEY_MAP).some(id => {
    const el = document.getElementById("key-" + id);
    return el && el.value.trim();
  });
  if (anyKey) {
    const banner = document.getElementById("setup-banner");
    if (banner) banner.style.display = "none";
  }
}

function loadTerminalModel(cfg) {
  const model = cfg?.models?.find(m => m.id === cfg?.currentModelId)?.model
    || cfg?.default?.model
    || "";
  const el = document.getElementById("terminal-model");
  if (el && model) el.textContent = model;
}

// ── Memory ────────────────────────────────────────────────────────────────────
let _memSearchTimer = null;

async function loadMemory(query) {
  const status = await AEGIS.getMemoryStatus();

  if (!status.subscribed) {
    renderMemorySubscribeView();
    return;
  }

  renderMemoryActiveView(status, query);
}

function renderMemorySubscribeView() {
  const panel = document.getElementById("tab-memory");
  panel.innerHTML = `
    <div class="mem-subscribe">
      <div class="mem-subscribe-icon">⬡</div>
      <div class="mem-subscribe-title">AEGIS Semantic Memory</div>
      <div class="mem-subscribe-sub">
        Cross-session memory — aegiscode remembers context, decisions and code
        across all your conversations.
      </div>
      <div class="mem-price">$2<span style="font-size:14px;font-weight:400;color:var(--text2)">/month</span></div>
      <div class="mem-price-sub">Billed via Stripe · cancel anytime</div>
      <button class="mem-subscribe-btn" onclick="openStripe()">Subscribe &amp; get API key ↗</button>
      <div class="mem-divider"></div>
      <div class="mem-activate-label">Paste your API key from the activation email:</div>
      <div class="mem-token-row">
        <input class="mem-token-input" id="mem-token-input" placeholder="Paste API key…" autocomplete="off">
        <button class="mem-token-btn" onclick="submitToken()">Activate</button>
      </div>
      <div class="mem-activate-msg" id="mem-activate-msg"></div>
    </div>
  `;

  // Allow Enter key in token input
  document.getElementById("mem-token-input")?.addEventListener("keydown", e => {
    if (e.key === "Enter") submitToken();
  });
}

async function openStripe() {
  const status = await AEGIS.getMemoryStatus();
  AEGIS.openExternal(status.stripeUrl);
}

async function submitToken() {
  const input = document.getElementById("mem-token-input");
  const msgEl = document.getElementById("mem-activate-msg");
  const token = (input?.value || "").trim();

  if (!token) return;

  msgEl.className = "mem-activate-msg";
  msgEl.textContent = "Activating…";

  const result = await AEGIS.activateMemory(token);

  if (result.ok) {
    msgEl.className = "mem-activate-msg mem-activate-ok";
    msgEl.textContent = `✓ Activated — welcome ${result.email || ""}`;
    // Reload the full memory view after a short delay
    setTimeout(() => loadMemory(), 1200);
  } else {
    msgEl.className = "mem-activate-msg mem-activate-err";
    msgEl.textContent = result.error || "Activation failed";
  }
}

async function renderMemoryActiveView(status, query) {
  // Restore panel structure if subscribe view replaced it
  const panel = document.getElementById("tab-memory");
  if (!document.getElementById("memory-stats")) {
    panel.innerHTML = `
      <div class="memory-toolbar">
        <input class="memory-search" id="memory-search" placeholder="Search memory…" oninput="onMemorySearch(this.value)">
        <button class="btn" onclick="loadMemory()">↺</button>
        <button class="btn" style="color:var(--red);border-color:var(--red)" onclick="confirmClearMemory()">Clear all</button>
      </div>
      <div class="memory-stats" id="memory-stats"></div>
      <div class="memory-list" id="memory-list"></div>
    `;
    // Restore search value
    if (query) document.getElementById("memory-search").value = query;
  }

  const [stats, entries] = await Promise.all([
    AEGIS.getMemoryStats(),
    AEGIS.searchMemory(query || ""),
  ]);

  // Badge
  const badge = document.getElementById("memory-badge");
  if (badge) badge.textContent = stats.total > 0 ? stats.total : "";

  // Status row if email known
  const activatedLine = status?.email && status.email !== "stripe-user"
    ? `<div class="mem-stat"><div class="mem-stat-val" style="font-size:11px;color:var(--green)">✓ ${escHtml(status.email)}</div><div class="mem-stat-label">Account</div></div>`
    : "";

  // Stats bar
  const statsEl = document.getElementById("memory-stats");
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="mem-stat"><div class="mem-stat-val">${stats.total}</div><div class="mem-stat-label">Entries</div></div>
      <div class="mem-stat"><div class="mem-stat-val">${stats.sessions}</div><div class="mem-stat-label">Sessions</div></div>
      <div class="mem-stat"><div class="mem-stat-val">${stats.byRole.user}</div><div class="mem-stat-label">User</div></div>
      <div class="mem-stat"><div class="mem-stat-val">${stats.byRole.assistant}</div><div class="mem-stat-label">Assistant</div></div>
      ${activatedLine}
    `;
  }

  // Entry list
  const listEl = document.getElementById("memory-list");
  if (!listEl) return;

  if (!entries.length) {
    listEl.innerHTML = `<div class="memory-empty">⬡<br><br>${query ? 'No results for &ldquo;' + escHtml(query) + '&rdquo;' : "Memory is empty."}</div>`;
    return;
  }

  listEl.innerHTML = entries.map((e, i) => {
    const role = (e.tags || []).find(t => t === "user" || t === "assistant") || "other";
    const tagClass = `mem-tag-${role}`;
    const ts = e.timestamp ? new Date(e.timestamp).toLocaleString(undefined, { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }) : "";
    const content = escHtml((e.content || "").trim());
    const isLong = (e.content || "").length > 180;
    return `
      <div class="mem-entry">
        <div class="mem-entry-header">
          <span class="mem-tag ${tagClass}">${role}</span>
          ${e.source && e.source !== "aegis-cli" ? `<span class="mem-tag mem-tag-other">${escHtml(e.source)}</span>` : ""}
          <span class="mem-ts">${ts}</span>
        </div>
        <div class="mem-content" id="mc-${i}">${content}</div>
        ${isLong ? `<div class="mem-expand" id="mx-${i}" onclick="toggleMemEntry(${i})">show more ▾</div>` : ""}
        <div class="mem-session">${(e.session || "").slice(0, 20)}</div>
      </div>`;
  }).join("");

  // Show "show more" buttons for long entries
  entries.forEach((e, i) => {
    if ((e.content || "").length > 180) {
      const btn = document.getElementById(`mx-${i}`);
      if (btn) btn.style.display = "block";
    }
  });
}

function toggleMemEntry(i) {
  const content = document.getElementById(`mc-${i}`);
  const btn     = document.getElementById(`mx-${i}`);
  if (!content || !btn) return;
  const expanded = content.classList.toggle("expanded");
  btn.textContent = expanded ? "show less ▴" : "show more ▾";
}

function onMemorySearch(val) {
  clearTimeout(_memSearchTimer);
  _memSearchTimer = setTimeout(() => loadMemory(val), 250);
}

async function confirmClearMemory() {
  if (!confirm("Clear all memory entries? This cannot be undone.")) return;
  await AEGIS.clearMemory();
  document.getElementById("memory-search").value = "";
  loadMemory();
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

  // Show setup banner if no provider key configured in .env
  const env = await AEGIS.getEnv();
  const hasKey = Object.values(KEY_MAP).some(k => env[k]);
  if (!hasKey) {
    const banner = document.getElementById("setup-banner");
    if (banner) banner.style.display = "flex";
  }

  // Show version in sidebar
  const verEl = document.getElementById("nav-version");
  if (verEl) verEl.textContent = "v1.0.0";

  // Load memory badge count
  AEGIS.getMemoryStats().then(stats => {
    const badge = document.getElementById("memory-badge");
    if (badge && stats.total > 0) badge.textContent = stats.total;
  }).catch(() => {});
});
