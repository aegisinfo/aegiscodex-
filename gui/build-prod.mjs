#!/usr/bin/env node
/**
 * Production build script:
 * 1. Obfuscates main.js and src/app.js in-place
 * 2. Runs electron-builder with chosen platform flag
 * 3. Restores originals regardless of build outcome
 */
import JavaScriptObfuscator from "javascript-obfuscator";
import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const OBFUSCATE_OPTS = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  stringArray: true,
  stringArrayEncoding: ["base64"],
  stringArrayThreshold: 0.2,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  splitStrings: false,
  identifierNamesGenerator: "mangled",
  renameGlobals: false,
  selfDefending: false,
  disableConsoleOutput: false,
  sourceMap: false,
};

const TARGETS = [
  "main.js",
  "src/app.js",
];

const originals = {};

function obfuscate() {
  for (const file of TARGETS) {
    const src = readFileSync(file, "utf8");
    originals[file] = src;
    const result = JavaScriptObfuscator.obfuscate(src, OBFUSCATE_OPTS);
    writeFileSync(file, result.getObfuscatedCode(), "utf8");
    console.log(`✓ Obfuscated ${file}`);
  }
}

function restore() {
  for (const [file, src] of Object.entries(originals)) {
    writeFileSync(file, src, "utf8");
    console.log(`↺ Restored ${file}`);
  }
}

const platform = process.argv[2] || "--linux";
const extraArgs = process.argv.slice(3).join(" ");
console.log(`\n[build-prod] Building for ${platform}\n`);

try {
  // Pre-compile node-pty for Electron before electron-builder runs
  // (electron-builder's internal rebuild hangs trying to download homebridge prebuilts)
  console.log("⚙ Compiling node-pty for Electron…");
  execSync("npx --yes @electron/rebuild@latest -f -w @homebridge/node-pty-prebuilt-multiarch", { stdio: "inherit" });

  obfuscate();
  execSync(`npx electron-builder ${platform} ${extraArgs}`.trim(), { stdio: "inherit" });
} finally {
  restore();
}
