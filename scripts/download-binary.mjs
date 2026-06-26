#!/usr/bin/env node
/**
 * postinstall script — downloads the prebuilt aegis-cli binary for the current platform.
 * The binary is saved to <package>/bin/ and then spawned by bin/cli.js.
 *
 * Requires zero external dependencies (uses only Node.js built-ins).
 *
 * Binary source: GitHub releases
 *   https://github.com/aegisinfo/aegiscode/releases/latest/download/aegis-cli-{platform}-{arch}
 */

import { createWriteStream, existsSync, chmodSync, mkdirSync } from 'fs';
import { get } from 'https';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');
const BIN_DIR = join(PACKAGE_ROOT, 'bin');

const BASE_URL =
  'https://github.com/aegisinfo/aegiscode/releases/latest/download';

// Maps Node.js process.platform + process.arch → GitHub release asset name
const PLATFORM_MAP = {
  'linux-x64':       'aegis-cli-linux-x64',
  'linux-arm64':     'aegis-cli-linux-arm64',
  'darwin-x64':      'aegis-cli-darwin-x64',
  'darwin-arm64':    'aegis-cli-darwin-arm64',
  'win32-x64':       'aegis-cli-win-x64.exe',
};

// Fallback URLs for platforms that don't have a dedicated binary yet
const FALLBACK_MAP = {
  'linux-arm':       'aegis-cli-linux-arm64',
  'darwin':          'aegis-cli-darwin-x64',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectBinaryName() {
  const os = process.platform;
  const arch = process.arch;
  const key = `${os}-${arch}`;

  if (PLATFORM_MAP[key]) return PLATFORM_MAP[key];

  // Try fallback (e.g. linux-arm → linux-arm64 binary if close enough)
  for (const [pattern, fallback] of Object.entries(FALLBACK_MAP)) {
    if (key.startsWith(pattern)) return fallback;
  }

  throw new Error(
    `Unsupported platform: ${key}\n` +
    `  Supported: ${Object.keys(PLATFORM_MAP).join(', ')}\n` +
    `  You can build from source: git clone https://github.com/aegisinfo/aegiscode && cd aegiscode && npm install && npm run build`
  );
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const req = get(url, (res) => {
      // Follow redirect (GitHub releases redirect to S3)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        // Avoid file-exists check on redirect target — let the stream overwrite
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        file.close();
        // Try to collect error body
        let body = '';
        res.on('data', (chunk) => (body += chunk.toString()));
        res.on('end', () => {
          const detail = body.trim().slice(0, 200);
          reject(
            new Error(`HTTP ${res.statusCode} — ${detail || 'no body'}`)
          );
        });
        return;
      }

      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });

    req.on('error', (err) => {
      file.close();
      // Attempt cleanup
      try { file.close(); } catch { /* ignore */ }
      reject(err);
    });

    req.setTimeout(60_000, () => {
      req.destroy();
      reject(new Error('Download timed out after 60s'));
    });
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const binaryName = detectBinaryName();
  const url = `${BASE_URL}/${binaryName}`;
  const dest = join(BIN_DIR, binaryName);

  // Check if binary already exists (reinstall / postinstall after prepublish)
  if (existsSync(dest)) {
    console.log(`✓ aegis-cli already installed at ${dest}`);
    chmodSync(dest, 0o755);
    return;
  }

  console.log(`⬡ Downloading aegis-cli for ${process.platform}-${process.arch}...`);

  mkdirSync(BIN_DIR, { recursive: true });

  try {
    await downloadFile(url, dest);
    chmodSync(dest, 0o755);
    console.log(`✓ aegis-cli installed to ${dest}`);
  } catch (err) {
    console.error('');
    console.error(`⚠ Failed to download aegis-cli binary: ${err.message}`);
    console.error('');
    console.error('  Possible causes:');
    console.error('    • No binary release for your platform yet');
    console.error('    • No internet connectivity');
    console.error('    • GitHub releases are unavailable');
    console.error('');
    console.error('  Options:');
    console.error('    1. Download manually from: https://github.com/aegisinfo/aegiscode/releases');
    console.error('       and place the binary in: ' + BIN_DIR);
    console.error('    2. Build from source:');
    console.error('       git clone https://github.com/aegisinfo/aegiscode');
    console.error('       cd aegiscode && npm install && npm run build');
    console.error('    3. Install via installer script:');
    console.error('       curl -fsSL https://dl.aegiscloud.org/install.sh | bash');
    console.error('');
    process.exit(1);
  }
}

main();
