"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("AEGIS", {
  getConfig:    ()        => ipcRenderer.invoke("get-config"),
  saveConfig:   (d)       => ipcRenderer.invoke("save-config", d),
  getHistory:   ()        => ipcRenderer.invoke("get-history"),
  getCloud:     ()        => ipcRenderer.invoke("get-cloud"),
  openExternal: (url)     => ipcRenderer.invoke("open-external", url),

  ptySpawn:  (opts)       => ipcRenderer.invoke("pty-spawn", opts),
  ptyWrite:  (data)       => ipcRenderer.invoke("pty-write", data),
  ptyResize: (opts)       => ipcRenderer.invoke("pty-resize", opts),
  ptyKill:   ()           => ipcRenderer.invoke("pty-kill"),

  onPtyData: (cb)         => ipcRenderer.on("pty-data", (_, d) => cb(d)),
  onPtyExit: (cb)         => ipcRenderer.on("pty-exit", (_, c) => cb(c)),

  getMemoryStats: ()      => ipcRenderer.invoke("get-memory-stats"),
  searchMemory:   (q)     => ipcRenderer.invoke("search-memory", q),
  clearMemory:    ()      => ipcRenderer.invoke("clear-memory"),
});
