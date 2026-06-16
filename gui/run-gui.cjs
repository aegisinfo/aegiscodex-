#!/usr/bin/env node
"use strict";
const { spawn } = require("child_process");
const path = require("path");

const guiDir = path.resolve(__dirname);
const electron = path.join(guiDir, "node_modules", ".bin", "electron");

spawn(electron, ["."], {
  cwd: guiDir,
  stdio: "inherit",
  env: { ...process.env, ELECTRON_IS_DEV: "1" },
}).on("exit", (code) => process.exit(code ?? 0));
