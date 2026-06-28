/**
 * make-bin.mjs — copies the built dist/main.js to bin/cli.js as-is (no obfuscation).
 */

import { readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, '..', 'dist', 'main.js');
const dest = join(__dirname, '..', 'bin', 'cli.js');

mkdirSync(join(__dirname, '..', 'bin'), { recursive: true });
writeFileSync(dest, readFileSync(src, 'utf-8'), 'utf-8');
chmodSync(dest, 0o755);

console.log(`✓ bin/cli.js written (unobfuscated)`);
