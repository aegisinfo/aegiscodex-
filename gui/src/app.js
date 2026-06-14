"use strict";

// ── Tab switching ─────────────────────────────────────────────────────────────
const __cache = { _t: {} };
function cache(key, ttlMs, fetcher) {
  const c = __cache[key];
  if (c && Date.now() - c.ts < ttlMs) return c.v;
  const v = fetcher();
  __cache[key] = { v, ts: Date.now() };
  return v;
}
function invalidateCache(key) { delete __cache[key]; }
function invalidateCachePrefix(prefix) {
  for (const k of Object.keys(__cache)) if (k.startsWith(prefix)) delete __cache[k];
}

function switchTab(tab) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById("tab-" + tab)?.classList.add("active");
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add("active");

  // Show terminal controls in titlebar only when terminal is active
  document.getElementById("terminal-controls")?.classList.toggle("visible", tab === "terminal");

  if (tab === "history")  loadHistory();
  if (tab === "memory")   loadMemory();
  if (tab === "cloud")    loadCloud();
  if (tab === "settings") loadSettings();

  if (tab === "terminal" && fitAddon) {
    requestAnimationFrame(() => {
      fitAddon.fit();
      if (term && term.cols > 0) AEGIS.ptyResize({ cols: term.cols, rows: term.rows });
    });
  }
}

// ── Terminal performance helpers ──────────────────────────────────────────────

// WebGL renderer — 3-5x faster than canvas for streaming output
function tryWebGL(t) {
  try {
    if (typeof Unicode11Addon !== "undefined") {
      t.loadAddon(new Unicode11Addon.Unicode11Addon());
      t.unicode.activeVersion = "11";
    }
  } catch (_) {}
  // WebGL-renderer — fallbackar tyst till canvas om GPU/drivrutin inte stödjer
  try {
    const gl = new WebglAddon.WebglAddon();
    gl.onContextLoss(() => { gl.dispose(); });
    // Testa att WebGL faktiskt fungerar
    t.loadAddon(gl);
    // Verifiera genom att kolla renderer typ
    requestAnimationFrame(() => {
      try { gl._canvas?.getContext?.("webgl2"); } catch {}
    });
  } catch (_) {
    // Fallback till canvas renderas automatiskt av xterm.js
  }
}

// Batch writes till en per animation frame — eliminerar per-chunk reflow lag.
// xterm.js 5.x processar write() via setTimeout(0), skilt från RAF-cykeln. Det betyder att
// en browser-paint kan ske INNAN write-callbacken anropas, vilket ger ett synligt jitter-frame
// när många rader läggs till på en gång (t.ex. under ollama-tänkfasen).
// Fix: persistent `following`-boolean (hanteras av onScroll, inte per-frame check) +
// "double-tap" RAF efter write-callbacken för att fånga sent-render-fallet.
function makeBatchedWriter(t) {
  let buf = "", raf = null, destroyed = false;
  let following = true, ignoreScroll = false;

  t.onScroll(() => {
    if (ignoreScroll) return;
    const active = t.buffer.active;
    following = active.viewportY >= active.length - t.rows - 1;
  });

  function snap() {
    if (destroyed) return;
    ignoreScroll = true;
    t.scrollToBottom();
    ignoreScroll = false;
  }

  return data => {
    if (destroyed || !t || !t.element) return;
    buf += data;
    if (!raf) raf = requestAnimationFrame(() => {
      const chunk = buf; buf = ""; raf = null;
      try {
        if (following) {
          t.write(chunk, () => {
            snap();
            requestAnimationFrame(() => { if (following) snap(); });
          });
        } else {
          t.write(chunk);
        }
      } catch (_) { destroyed = true; }
    });
  };
}

// ── xterm.js setup ────────────────────────────────────────────────────────────
let term         = null;
let fitAddon     = null;
let shellTerm    = null;
let shellFit     = null;
let lastResumeId = null;
let _spawning    = false;

function initTerminal() {
  const container = document.getElementById("xterm-container");

  term = new Terminal({
    fontFamily: '"Cascadia Code","Fira Code","JetBrains Mono","Consolas",monospace',
    fontWeight: "400",
    fontWeightBold: "700",
    fontSize:   13,
    lineHeight: 1.25,
    letterSpacing: 0,
    cursorBlink:true,
    cursorStyle:"block",
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
    allowTransparency: false,
    scrollback: 10000,
    rightClickSelectsWord: true,
    fastScrollModifier: "shift",
    fastScrollSensitivity: 5,
    smoothScrollDuration: 0,
    overviewRulerWidth: 10,
    macOptionIsMeta: true,
    drawBoldTextInBrightColors: false,
    minimumContrastRatio: 1,
    rescaleOverlappingGlyphs: true,
  });

  fitAddon = new FitAddon.FitAddon();
  const linkAddon = new WebLinksAddon.WebLinksAddon((_, url) => AEGIS.openExternal(url));

  term.loadAddon(fitAddon);
  term.loadAddon(linkAddon);
  term.open(container);

  // WebGL renderer — much faster than Canvas for streaming output
  tryWebGL(term);

  // Defer initial fit until layout is complete
  requestAnimationFrame(() => {
    fitAddon.fit();
    spawnSession();
  });

  // Input → PTY
  term.onData(data => AEGIS.ptyWrite(data));

  // PTY output → terminal (batched per animation frame to handle fast streaming)
  AEGIS.onPtyData(makeBatchedWriter(term));

  // PTY exit
  AEGIS.onPtyExit(code => {
    setPtyStatus(false);
    term.writeln(`\r\n\x1b[2m[process exited with code ${code}]\x1b[0m`);
    term.writeln(`\x1b[2m[press any key or click ↺ New session to restart]\x1b[0m`);
  });

  // Resize observer — debounced för att undvika layout-thrashing
  let _roTimer = null;
  const ro = new ResizeObserver(() => {
    if (!fitAddon) return;
    if (_roTimer) cancelAnimationFrame(_roTimer);
    _roTimer = requestAnimationFrame(() => {
      _roTimer = null;
      try {
        fitAddon.fit();
        const { cols, rows } = term;
        if (cols > 0 && rows > 0) AEGIS.ptyResize({ cols, rows });
      } catch(_) {}
    });
  });
  ro.observe(container);

  // Keyboard: any key after exit restarts (guard against double-spawn)
  term.onKey(() => {
    const dot = document.getElementById("pty-dot");
    if (!dot.classList.contains("on")) spawnSession();
  });

  initShell();
  initResizer();
  initDragDrop();
}

// ── Drag-and-drop files into either terminal ───────────────────────────────────
function initDragDrop() {
  const overlay = document.getElementById("drag-overlay");
  const ovTop   = document.getElementById("drag-overlay-top");
  const ovBot   = document.getElementById("drag-overlay-bottom");
  if (!overlay || !ovTop || !ovBot) return;

  function hide() {
    overlay.classList.remove("active");
    ovTop.classList.remove("over");
    ovBot.classList.remove("over");
  }

  // Show overlay when any file enters the window
  document.addEventListener("dragenter", e => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    overlay.classList.add("active");
    e.preventDefault();
  });

  // Hide when drag leaves the window entirely (relatedTarget is null)
  document.addEventListener("dragleave", e => {
    if (e.relatedTarget == null) hide();
  });

  document.addEventListener("dragover", e => {
    if (e.dataTransfer?.types?.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  });

  // Highlight the hovered half
  ovTop.addEventListener("dragenter", () => { ovTop.classList.add("over"); ovBot.classList.remove("over"); });
  ovBot.addEventListener("dragenter", () => { ovBot.classList.add("over"); ovTop.classList.remove("over"); });

  // Drop — use webUtils.getPathForFile (Electron 32+; File.path was removed)
  ovTop.addEventListener("drop", e => handleDrop(e, d => AEGIS.ptyWrite(d)));
  ovBot.addEventListener("drop", e => handleDrop(e, d => AEGIS.shellWrite(d)));

  function handleDrop(e, write) {
    e.preventDefault();
    hide();
    const paths = [...e.dataTransfer.files]
      .map(f => AEGIS.getFilePath(f))
      .filter(Boolean);
    if (paths.length) write(paths.join(" ") + " ");
  }
}

// ── PTY control ───────────────────────────────────────────────────────────────
function setPtyStatus(on, label) {
  const dot  = document.getElementById("pty-dot");
  const text = document.getElementById("pty-status");
  dot.classList.toggle("on", on);
  text.textContent = label || (on ? "running" : "idle");
}

async function spawnSession(resumeId) {
  if (_spawning) return;
  _spawning = true;
  setPtyStatus(false, "starting…");
  lastResumeId = resumeId || null;
  const ok = await AEGIS.ptySpawn({ cols: term.cols, rows: term.rows, resumeId });
  _spawning = false;
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

// ── Shell terminal (bottom pane) ──────────────────────────────────────────────
function initShell() {
  const container = document.getElementById("shell-container");
  if (!container) return;

  shellTerm = new Terminal({
    fontFamily: '"Cascadia Code","Fira Code","JetBrains Mono","Consolas",monospace',
    fontWeight: "400",
    fontWeightBold: "700",
    fontSize:   13,
    lineHeight: 1.25,
    letterSpacing: 0,
    cursorBlink: true,
    cursorStyle: "bar",
    theme: {
      background:    "#000000",
      foreground:    "#c8d8e8",
      cursor:        "#00c8b4",
      cursorAccent:  "#000000",
      selectionBackground: "rgba(0,200,180,.25)",
      black:"#04060a",red:"#e04444",green:"#1ab87a",yellow:"#e89020",
      blue:"#5a7fd4",magenta:"#a06ad4",cyan:"#00c8b4",white:"#c8d8e8",
      brightBlack:"#2e4055",brightRed:"#f06060",brightGreen:"#20d890",
      brightYellow:"#f0a030",brightBlue:"#7a9fe4",brightMagenta:"#c090e0",
      brightCyan:"#20e0d0",brightWhite:"#e8f0f8",
    },
    allowTransparency: false,
    scrollback: 2000,
  });

  shellFit = new FitAddon.FitAddon();
  shellTerm.loadAddon(shellFit);
  shellTerm.loadAddon(new WebLinksAddon.WebLinksAddon((_, url) => AEGIS.openExternal(url)));
  shellTerm.open(container);

  tryWebGL(shellTerm);

  // Ctrl+C = kopiera (om markering), annars SIGINT
  // Ctrl+Z = döda shell-processen
  shellTerm.attachCustomKeyEventHandler(e => {
    if (e.type !== "keydown") return true;

    // Ctrl+C
    if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
      if (shellTerm.hasSelection()) {
        const sel = shellTerm.getSelection();
        if (sel) { AEGIS.copyText(sel); shellTerm.clearSelection(); }
        return false; // don't send to shell
      }
      return true; // pass through (SIGINT)
    }

    // Ctrl+Z — döda shell:et (istället för suspend)
    if (e.ctrlKey && (e.key === "z" || e.key === "Z")) {
      AEGIS.shellKill();
      return false;
    }

    return true;
  });

  // Skicka tangenttryckningar till shell:et
  shellTerm.onData(data => AEGIS.shellWrite(data));

  // PTY utdata → terminal
  AEGIS.onShellData(makeBatchedWriter(shellTerm));

  // När shell:et dör: auto-återskapa efter 500 ms
  let _restartTimer = null;
  AEGIS.onShellExit(() => {
    shellTerm.writeln("\r\n\x1b[2m[shell exited — restarting...]\x1b[0m");
    if (_restartTimer) clearTimeout(_restartTimer);
    _restartTimer = setTimeout(() => {
      _restartTimer = null;
      shellTerm.clear();
      requestAnimationFrame(() => {
        shellFit.fit();
        AEGIS.shellSpawn({ cols: shellTerm.cols, rows: shellTerm.rows });
      });
    }, 500);
  });

  // Resize observer — debounced
  let _shTimer = null;
  const ro = new ResizeObserver(() => {
    if (!shellFit) return;
    if (_shTimer) cancelAnimationFrame(_shTimer);
    _shTimer = requestAnimationFrame(() => {
      _shTimer = null;
      try {
        shellFit.fit();
        const { cols, rows } = shellTerm;
        if (cols > 0 && rows > 0) AEGIS.shellResize({ cols, rows });
      } catch(_) {}
    });
  });
  ro.observe(container);

  // Starta shell:et direkt
  requestAnimationFrame(async () => {
    shellFit.fit();
    const res = await AEGIS.shellSpawn({ cols: shellTerm.cols, rows: shellTerm.rows });
    const cwdEl = document.getElementById("shell-cwd");
    if (cwdEl && res?.cwd) cwdEl.textContent = res.cwd;
  });
}

// ── Draggable resizer between aegiscode and shell ─────────────────────────────
function initResizer() {
  const resizer = document.getElementById("term-resizer");
  const top     = document.querySelector(".term-top");
  const bottom  = document.querySelector(".term-bottom");
  if (!resizer || !top || !bottom) return;

  let dragging = false, startY = 0, startTop = 0, startBot = 0;

  resizer.addEventListener("mousedown", e => {
    dragging = true;
    startY   = e.clientY;
    startTop = top.offsetHeight;
    startBot = bottom.offsetHeight;
    resizer.classList.add("dragging");
    document.body.style.cursor     = "ns-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  });

  document.addEventListener("mousemove", e => {
    if (!dragging) return;
    const dy      = e.clientY - startY;
    const newTop  = Math.max(80,  startTop + dy);
    const newBot  = Math.max(60,  startBot - dy);
    top.style.flex   = "none";
    top.style.height = newTop + "px";
    bottom.style.height = newBot + "px";
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove("dragging");
    document.body.style.cursor     = "";
    document.body.style.userSelect = "";
    requestAnimationFrame(() => {
      fitAddon?.fit();
      shellFit?.fit();
      if (term     && term.cols     > 0) AEGIS.ptyResize  ({ cols: term.cols,     rows: term.rows });
      if (shellTerm && shellTerm.cols > 0) AEGIS.shellResize({ cols: shellTerm.cols, rows: shellTerm.rows });
    });
  });
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
  // memtoken handled separately (requires server verification)
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
  const [env, cfg, memStatus] = await Promise.all([AEGIS.getEnv(), AEGIS.getConfig(), AEGIS.getMemoryStatus()]);
  // cache for saveSettings
  __cache._env = env; __cache._cfg = cfg;

  const cloudKey   = cfg?.aegiscloud?.api_key || "";
  const syncOn     = cfg?.aegiscloud?.syncConversations !== false;
  const memToken   = env["AEGIS_MEMORY_TOKEN"] || "";
  const memActive  = memStatus?.subscribed || !!memToken;

  const PROVIDERS = [
    { id: "anthropic", label: "Anthropic (Claude)", envKey: "ANTHROPIC_API_KEY", ph: "sk-ant-…",              type: "password" },
    { id: "openai",    label: "OpenAI (GPT)",       envKey: "OPENAI_API_KEY",    ph: "sk-…",                  type: "password" },
    { id: "deepseek",  label: "DeepSeek",            envKey: "DEEPSEEK_API_KEY",  ph: "sk-…",                  type: "password" },
    { id: "groq",      label: "Groq",                envKey: "GROQ_API_KEY",      ph: "gsk_…",                 type: "password" },
    { id: "gemini",    label: "Google Gemini",        envKey: "GEMINI_API_KEY",    ph: "AIza…",                 type: "password" },
    { id: "ollama",    label: "Ollama",               envKey: "OLLAMA_BASE_URL",   ph: "http://localhost:11434", type: "text" },
  ];

  const providerRows = PROVIDERS.map(p => {
    const val  = escAttr(env[p.envKey] || "");
    const set  = !!env[p.envKey];
    const eye  = p.type === "password"
      ? `<button class="api-row-toggle" onclick="toggleKeyVis('${p.id}')">${set ? "show" : "show"}</button>`
      : `<div style="width:52px"></div>`;
    return `
      <div class="api-row">
        <div class="api-row-info">
          <div class="api-row-label">${p.label}</div>
          <div class="api-row-var">${p.envKey}</div>
        </div>
        <input class="api-row-input" type="${p.type}" id="key-${p.id}"
               placeholder="${p.ph}" autocomplete="off" value="${val}">
        ${eye}
        <div class="api-dot${set ? " set" : ""}" id="dot-${p.id}"></div>
      </div>`;
  }).join("");

  document.getElementById("settings-content").innerHTML = `
    <div class="settings-body">
      <div class="settings-section">
        <h3>AI Provider Keys</h3>
        <div class="section-hint">Saved to ~/.aegiscode/.env — shared with the CLI</div>
        ${providerRows}
      </div>

      <div class="settings-section">
        <h3>AEGIS Memory</h3>
        <div class="section-hint">Paste your token to activate cross-session memory</div>
        <div class="api-row">
          <div class="api-row-info">
            <div class="api-row-label" style="display:flex;align-items:center;gap:8px">
              Memory Token
              <span style="font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600;letter-spacing:.5px;
                background:${memActive ? "rgba(26,184,122,.15)" : "rgba(155,155,152,.1)"};
                color:${memActive ? "#1ab87a" : "#9b9b98"}">
                ${memActive ? "● active" : "○ inactive"}
              </span>
            </div>
            <div class="api-row-var">AEGIS_MEMORY_TOKEN</div>
          </div>
          <input class="api-row-input" type="password" id="key-memtoken"
                 placeholder="pUm-…" autocomplete="off" value="${escAttr(memToken)}">
          <button class="api-row-toggle" onclick="toggleKeyVis('memtoken')">show</button>
          <div class="api-dot${memToken ? " set" : ""}" id="dot-memtoken"></div>
        </div>
      </div>

      <div class="settings-section">
        <h3>AEGIS Cloud</h3>
        <div class="section-hint">Enables memory &amp; conversation sync</div>
        <div class="api-row">
          <div class="api-row-info">
            <div class="api-row-label">Cloud API Key</div>
            <div class="api-row-var">aegiscloud.org</div>
          </div>
          <input class="api-row-input" type="password" id="s-cloudkey"
                 placeholder="aegis_…" autocomplete="off" value="${escAttr(cloudKey)}">
          <button class="api-row-toggle" onclick="toggleKeyVis('cloudkey','s-cloudkey')">show</button>
          <div class="api-dot${cloudKey ? " set" : ""}" id="dot-cloudkey"></div>
        </div>
        <div class="field" style="margin-top:10px">
          <label>Auto-upload on exit</label>
          <select id="s-cloudsync">
            <option value="on"${syncOn  ? " selected" : ""}>Enabled</option>
            <option value="off"${!syncOn ? " selected" : ""}>Disabled</option>
          </select>
        </div>
      </div>
    </div>

    <div class="settings-footer">
      <button class="btn btn-primary" onclick="saveSettings()">Save settings</button>
      <span class="save-note" id="save-note" style="display:none">✓ Saved</span>
    </div>
  `;
}

function _showSaveNote(msg, isError) {
  const note = document.getElementById("save-note");
  if (!note) return;
  note.textContent  = msg;
  note.style.color  = isError ? "var(--red, #e04444)" : "";
  note.style.display = "inline";
  setTimeout(() => {
    note.style.display = "none";
    note.textContent = "✓ Saved";
    note.style.color = "";
  }, isError ? 5000 : 2000);
}

async function saveSettings() {
  const env = __cache._env || await AEGIS.getEnv();
  const cfg = __cache._cfg || await AEGIS.getConfig();

  // Write provider keys to .env
  Object.entries(KEY_MAP).forEach(([id, envKey]) => {
    const el  = document.getElementById("key-" + id);
    if (!el) return;
    const val = el.value.trim();
    if (val) env[envKey] = val;
    else     delete env[envKey];
    setApiDot(id, val);
  });

  // ── Memory token — server verification required ───────────────────────────
  const memTokenEl  = document.getElementById("key-memtoken");
  const memTokenVal = (memTokenEl?.value || "").trim();
  const existingTok = (env["AEGIS_MEMORY_TOKEN"] || "").trim();

  if (memTokenVal && memTokenVal !== existingTok) {
    // New token entered — verify against aegiscloud.org before saving
    _showSaveNote("Verifying token…", false);
    const result = await AEGIS.verifyMemoryToken(memTokenVal);
    if (!result.ok) {
      if (memTokenEl) memTokenEl.value = existingTok; // restore old value
      setApiDot("memtoken", existingTok);
      _showSaveNote("✗ " + result.error, true);
      return; // abort — don't save anything
    }
    env["AEGIS_MEMORY_TOKEN"] = memTokenVal;
    setApiDot("memtoken", memTokenVal);
  } else if (!memTokenVal && existingTok) {
    // Token cleared
    delete env["AEGIS_MEMORY_TOKEN"];
    setApiDot("memtoken", "");
  }

  await AEGIS.saveEnv(env);

  // Update memory status badge
  const savedTok  = (env["AEGIS_MEMORY_TOKEN"] || "").trim();
  const memBadge  = memTokenEl?.closest(".api-row")?.querySelector(".api-row-label span");
  if (memBadge) {
    memBadge.textContent       = savedTok ? "● active" : "○ inactive";
    memBadge.style.background  = savedTok ? "rgba(26,184,122,.15)" : "rgba(155,155,152,.1)";
    memBadge.style.color       = savedTok ? "#1ab87a" : "#9b9b98";
  }

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
  invalidateCachePrefix("cfg");

  _showSaveNote("✓ Saved", false);

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
  const found = cfg?.models?.find(m => m.id === cfg?.currentModelId);
  const model = found ? (found.model || "") : (cfg?.default?.model || "");
  const el = document.getElementById("terminal-model");
  if (el) el.textContent = model;
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

  // Show "show more" buttons for long entries (only first 200 rendered)
  const maxRender = 200;
  entries.slice(0, maxRender).forEach((e, i) => {
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

function escAttr(s) {
  return (s || "").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

// ── Model display update ──────────────────────────────────────────────────────
function refreshModelDisplay() {
  AEGIS.getConfig().then(cfg => {
    const model = cfg?.models?.find(m => m.id === cfg?.currentModelId)?.model
      || cfg?.default?.model
      || "";
    const el = document.getElementById("terminal-model");
    if (el) el.textContent = model;
  }).catch(() => {});
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  initTerminal();
  document.getElementById("terminal-controls")?.classList.add("visible");

  // Load config for sidebar version + model display
  const cfg = await AEGIS.getConfig();
  loadTerminalModel(cfg);

  // Show setup banner if no provider key configured in .env
  const env = await AEGIS.getEnv();
  const hasKey = Object.values(KEY_MAP).some(k => env[k]);
  if (!hasKey) {
    const banner = document.getElementById("setup-banner");
    if (banner) banner.style.display = "flex";
  }

  // Show version in sidebar
  const verEl = document.getElementById("nav-version");
  AEGIS.getVersion().then(v => { if (verEl) verEl.textContent = "v" + v; }).catch(() => {});

  // Load memory badge count
  AEGIS.getMemoryStats().then(stats => {
    const badge = document.getElementById("memory-badge");
    if (badge && stats.total > 0) badge.textContent = stats.total;
  }).catch(() => {});

  // Watch for config changes (e.g. /model command in PTY)
  AEGIS.onConfigChanged(() => refreshModelDisplay());
});
