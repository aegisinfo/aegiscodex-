#!/usr/bin/env node
/**
 * Obfuscate aegiscode dist/main.js using javascript-obfuscator.
 * Run after `npm run build` (which produces dist/main.js via esbuild).
 *
 * Usage:  node scripts/obfuscate.mjs
 * Env:    AEGIS_OBFUSCATE=0  skips obfuscation (default: on)
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "..", "dist", "main.js");

if (!existsSync(DIST)) {
  console.error(`[obfuscate] dist/main.js not found — run 'npm run build' first`);
  process.exit(1);
}

if (process.env.AEGIS_OBFUSCATE === "0") {
  console.log("[obfuscate] SKIPPED (AEGIS_OBFUSCATE=0)");
  process.exit(0);
}

let JavaScriptObfuscator;
try {
  JavaScriptObfuscator = (await import("javascript-obfuscator")).default;
} catch {
  console.error("[obfuscate] javascript-obfuscator not installed — run 'npm install'");
  process.exit(1);
}

const original = readFileSync(DIST, "utf8");
const result = JavaScriptObfuscator.obfuscate(original, {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  stringArray: true,
  stringArrayEncoding: ["rc4"],
  stringArrayThreshold: 0.85,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  splitStrings: false,
  identifierNamesGenerator: "mangled",
  renameGlobals: false,
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
  sourceMap: false,
});

const obfuscated = result.getObfuscatedCode();
const savedBytes = Buffer.byteLength(original, "utf8") - Buffer.byteLength(obfuscated, "utf8");
writeFileSync(DIST, obfuscated, "utf8");
console.log(`[obfuscate] ✓ Obfuscated dist/main.js (saved ${(savedBytes / 1024).toFixed(1)} kB)`);
