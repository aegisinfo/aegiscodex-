/**
 * obfuscate.mjs — reads dist/main.js, obfuscates it, writes bin/cli.js
 *
 * javascript-obfuscator strips the shebang, so we pull it out first,
 * obfuscate the rest, then prepend it back.
 */

import JavaScriptObfuscator from 'javascript-obfuscator';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src  = join(__dirname, 'dist', 'main.js');
const dest = join(__dirname, 'bin', 'cli.js');

mkdirSync(join(__dirname, 'bin'), { recursive: true });

let code = readFileSync(src, 'utf-8');

// Preserve shebang line
const shebangMatch = code.match(/^(#!.+)\n/);
const shebang = shebangMatch ? shebangMatch[1] + '\n' : '';
if (shebang) code = code.slice(shebang.length);

const result = JavaScriptObfuscator.obfuscate(code, {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.4,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.75,
  unicodeEscapeSequence: false,
});

writeFileSync(dest, shebang + result.getObfuscatedCode(), 'utf-8');

const bytes = Buffer.byteLength(shebang + result.getObfuscatedCode());
console.log(`✓ Obfuscated: bin/cli.js (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
