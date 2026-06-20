// Obfuscates the tracked dist/agent/*.js build output (the public Agent SDK
// surface) so a plain `git clone` doesn't ship readable compiled JS there.
// src/*.ts stays untouched and fully readable — this only runs against the
// already-committed compiled output.
import JavaScriptObfuscator from 'javascript-obfuscator';
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const files = execSync('git ls-files dist/agent', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f.endsWith('.js'));

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const result = JavaScriptObfuscator.obfuscate(src, {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    stringArray: true,
    stringArrayEncoding: ['rc4'],
    stringArrayThreshold: 0.85,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    splitStrings: false,
    identifierNamesGenerator: 'mangled',
    renameGlobals: false,
    selfDefending: false,
    debugProtection: false,
    disableConsoleOutput: false,
    sourceMap: false,
  });
  writeFileSync(file, result.getObfuscatedCode());
  console.log(`✓ obfuscated ${file}`);
}
