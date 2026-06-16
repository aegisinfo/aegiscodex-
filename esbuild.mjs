import * as esbuild from 'esbuild';
import { argv } from 'node:process';
import { readFileSync, writeFileSync } from 'node:fs';
import JavaScriptObfuscator from 'javascript-obfuscator';

const dev = argv.includes('--dev');
const publish = argv.includes('--publish');
const cjs = argv.includes('--cjs'); // for Node SEA standalone builds
const minify = !dev;
const sourcemap = dev;

if (cjs) {
  // CJS build for Node Single Executable Application (SEA)
  // Must be CJS — SEA doesn't support ESM import.meta in injected blobs
  await esbuild.build({
    entryPoints: ['src/main.tsx'],
    outfile: 'dist/sea-entry.cjs',
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    minify: true,
    external: ['sql.js', '@xenova/transformers'],
    define: {
      'import.meta.url': 'require("url").pathToFileURL(__filename).href',
    },
  });
  console.log('✓ CJS SEA entry built: dist/sea-entry.cjs');
} else {
  // Standard ESM build for npm/npx usage
  await esbuild.build({
    entryPoints: ['src/main.tsx'],
    outfile: 'dist/main.js',
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    sourcemap,
    minify,
    external: ['sql.js', '@xenova/transformers'],
    banner: {
      js: `#!/usr/bin/env node --no-deprecation
import __aegis_mod from'node:module';if(typeof require==='undefined'){globalThis.require=__aegis_mod.createRequire(import.meta.url);}
`,
    },
  });

  if (publish) {
    const src = readFileSync('dist/main.js', 'utf8');
    // Strip the shebang line before obfuscating — obfuscator doesn't handle it
    const shebangMatch = src.match(/^(#!.*\n(?:.*\n)?)/);
    const shebang = shebangMatch ? shebangMatch[1] : '';
    const body = shebang ? src.slice(shebang.length) : src;

    const result = JavaScriptObfuscator.obfuscate(body, {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.5,
      deadCodeInjection: false,
      stringArray: true,
      stringArrayEncoding: ['rc4'],
      stringArrayThreshold: 0.85,
      stringArrayRotate: true,
      stringArrayShuffle: true,
      splitStrings: true,
      splitStringsChunkLength: 8,
      identifierNamesGenerator: 'mangled',
      renameGlobals: false,
      selfDefending: true,
      debugProtection: false,
      disableConsoleOutput: false,
      sourceMap: false,
    });

    writeFileSync('dist/main.js', shebang + result.getObfuscatedCode(), 'utf8');
    console.log('✓ Obfuscated: dist/main.js');
  }

  // Ensure Node.js treats dist/main.js as ESM regardless of system package.json
  writeFileSync('dist/package.json', JSON.stringify({ type: 'module' }));

  const mode = dev ? 'dev (with sourcemaps)' : publish ? 'production (minified + obfuscated)' : 'production (minified)';
  const size = dev ? '' : ' — run `node dist/main.js` to verify';
  console.log(`✓ Build complete: dist/main.js (${mode})${size}`);
}
