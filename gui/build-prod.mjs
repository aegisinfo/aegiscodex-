#!/usr/bin/env node
/**
 * Production build script:
 * 1. Stages external modules (sql.js, @xenova/transformers)
 * 2. Runs electron-builder with chosen platform flag
 */
import { mkdirSync, cpSync, existsSync, readdirSync, symlinkSync, copyFileSync } from "fs";
import { execSync } from "child_process";
import { join, dirname, resolve } from "path";
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

function buildNodePtyForElectron() {
  const ptyDir    = join(__dirname, "node_modules/@homebridge/node-pty-prebuilt-multiarch");
  const nodeGyp   = join(__dirname, "node_modules/.bin/node-gyp");
  const nodedir   = resolve(process.env.HOME, ".electron-gyp/33.4.11");
  const built     = join(ptyDir, "build/Release/pty.node");
  const dest      = join(ptyDir, "prebuilds/linux-x64/electron.abi130.node");

  if (existsSync(dest)) { console.log("  ✓ electron.abi130.node already exists"); return; }

  // Download electron headers if not cached
  if (!existsSync(nodedir)) {
    console.log("  • downloading Electron 33 headers…");
    execSync(
      `"${nodeGyp}" install --target=33.4.11 --arch=x64 --dist-url=https://electronjs.org/headers`,
      { stdio: "inherit" }
    );
  }

  console.log("  • compiling node-pty for Electron 33 (ABI 130)…");
  execSync(`"${nodeGyp}" rebuild --target=33.4.11 --arch=x64 --nodedir="${nodedir}"`,
    { cwd: ptyDir, stdio: "inherit" });
  copyFileSync(built, dest);
  console.log("  ✓ electron.abi130.node placed in prebuilds");
}

stageExternalModules();
if (process.platform === "linux") buildNodePtyForElectron();
execSync(`npx electron-builder ${platform} ${extraArgs}`.trim(), { stdio: "inherit" });
