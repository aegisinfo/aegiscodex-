"use strict";
const { contextBridge, ipcRenderer, webUtils, clipboard } = require("electron");

contextBridge.exposeInMainWorld("AEGIS", {
  getEnv:       ()        => ipcRenderer.invoke("get-env"),
  saveEnv:      (d)       => ipcRenderer.invoke("save-env", d),
  getVersion:   ()        => ipcRenderer.invoke("get-version"),
  getConfig:    ()        => ipcRenderer.invoke("get-config"),
  saveConfig:   (d)       => ipcRenderer.invoke("save-config", d),
  getHistory:   ()        => ipcRenderer.invoke("get-history"),
  getCloud:     ()        => ipcRenderer.invoke("get-cloud"),
  openExternal: (url)     => ipcRenderer.invoke("open-external", url),

  ptySpawn:  (opts)       => ipcRenderer.invoke("pty-spawn", opts),
  ptyWrite:  (data)       => ipcRenderer.invoke("pty-write", data),
  ptyResize: (opts)       => ipcRenderer.invoke("pty-resize", opts),
  ptyKill:   ()           => ipcRenderer.invoke("pty-kill"),

  onPtyData: (cb)         => ipcRenderer.on("pty-data",   (_, d) => cb(d)),
  onPtyExit: (cb)         => ipcRenderer.on("pty-exit",   (_, c) => cb(c)),

  shellSpawn:  (opts)     => ipcRenderer.invoke("shell-spawn",  opts),
  shellWrite:  (data)     => ipcRenderer.invoke("shell-write",  data),
  shellResize: (opts)     => ipcRenderer.invoke("shell-resize", opts),
  shellKill:   ()         => ipcRenderer.invoke("shell-kill"),
  onShellData: (cb)       => ipcRenderer.on("shell-data", (_, d) => cb(d)),
  onShellExit: (cb)       => ipcRenderer.on("shell-exit", ()     => cb()),

  getMemoryStats:  ()      => ipcRenderer.invoke("get-memory-stats"),
  searchMemory:    (q)     => ipcRenderer.invoke("search-memory", q),
  clearMemory:     ()      => ipcRenderer.invoke("clear-memory"),
  getMemoryStatus: ()      => ipcRenderer.invoke("get-memory-status"),
  activateMemory:      (token) => ipcRenderer.invoke("activate-memory", token),
  verifyMemoryToken:   (token) => ipcRenderer.invoke("verify-memory-token", token),

  getFilePath: (file) => webUtils.getPathForFile(file),
  copyText:    (text) => clipboard.writeText(text),

  onConfigChanged: (cb)     => ipcRenderer.on("config-changed", (_, c) => cb(c)),
});
