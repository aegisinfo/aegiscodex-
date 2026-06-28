import * as esbuild from 'esbuild';
import { argv } from 'node:process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const stubPath = fileURLToPath(new URL('./scripts/empty-stub.mjs', import.meta.url));

const dev = argv.includes('--dev');
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
    alias: { 'react-devtools-core': stubPath },
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
    alias: { 'react-devtools-core': stubPath },
    banner: {
      js: `#!/usr/bin/env -S node --no-deprecation
import __aegis_mod from'node:module';if(typeof require==='undefined'){globalThis.require=__aegis_mod.createRequire(import.meta.url);}
`,
    },
  });

  // Ensure Node.js treats dist/main.js as ESM regardless of system package.json
  writeFileSync('dist/package.json', JSON.stringify({ type: 'module' }));

  const mode = dev ? 'dev (with sourcemaps)' : 'production (minified)';
  const size = dev ? '' : ' — run `node dist/main.js` to verify';
  console.log(`✓ Build complete: dist/main.js (${mode})${size}`);
}
