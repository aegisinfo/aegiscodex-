#!/usr/bin/env node
/**
 * Production build script:
 * 1. Stages external modules (sql.js, @xenova/transformers)
 * 2. Runs electron-builder with chosen platform flag
 */
import { mkdirSync, cpSync, existsSync, readdirSync, symlinkSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function stageExternalModules() {
  const src = join(__dirname, "..", "node_modules");
  const dst = join(__dirname, "staged-external", "node_modules");
  for (const pkg of ["sql.js", "@xenova/transformers", "@huggingface/jinja"]) {
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

const platform = process.argv[2] || "--linux";
const extraArgs = process.argv.slice(3).join(" ");
console.log(`\n[build-prod] Building for ${platform}\n`);

function patchNodePtyPrebuilds() {
  const prebuildDir = join(__dirname, "node_modules/@homebridge/node-pty-prebuilt-multiarch/prebuilds");
  if (!existsSync(prebuildDir)) return;
  for (const arch of readdirSync(prebuildDir)) {
    const archDir = join(prebuildDir, arch);
    for (const file of readdirSync(archDir)) {
      if (file.startsWith("node.abi") && file.endsWith(".node")) {
        const electronFile = file.replace("node.", "electron.");
        const target = join(archDir, electronFile);
        if (!existsSync(target)) symlinkSync(file, target);
      }
    }
  }
}

stageExternalModules();
patchNodePtyPrebuilds();
execSync(`npx electron-builder ${platform} ${extraArgs}`.trim(), { stdio: "inherit" });
