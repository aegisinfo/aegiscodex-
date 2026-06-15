#!/usr/bin/env node
/**
 * Production build script:
 * 1. Obfuscates main.js and src/app.js in-place
 * 2. Runs electron-builder with chosen platform flag
 * 3. Restores originals regardless of build outcome
 */
import JavaScriptObfuscator from "javascript-obfuscator";
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function stageExternalModules() {
  const src = join(__dirname, "..", "node_modules");
  const dst = join(__dirname, "staged-external", "node_modules");
  for (const pkg of ["sql.js", "@xenova/transformers"]) {
    const from = join(src, pkg);
    const to   = join(dst, pkg);
    if (existsSync(from)) {
      mkdirSync(dirname(to), { recursive: true });
      cpSync(from, to, { recursive: true });
    } else {
      console.warn(`⚠ staged-external: ${pkg} not found in ${src}`);
    }
  }
}

const OBFUSCATE_OPTS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: false,          // keep bundle small
  stringArray: true,
  stringArrayEncoding: ["rc4"],
  stringArrayThreshold: 0.85,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  identifierNamesGenerator: "mangled",
  renameGlobals: false,              // don't break electron globals
  selfDefending: true,               // detects tampering at runtime
  disableConsoleOutput: false,       // keep console for electron logs
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
  stageExternalModules();
  obfuscate();
  execSync(`npx electron-builder ${platform} ${extraArgs}`.trim(), { stdio: "inherit" });
} finally {
  restore();
}
