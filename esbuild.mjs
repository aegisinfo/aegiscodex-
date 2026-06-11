import * as esbuild from 'esbuild';
import { argv } from 'node:process';

const dev = argv.includes('--dev');
const minify = !dev;
const sourcemap = dev;

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

const mode = dev ? 'dev (with sourcemaps)' : 'production (minified)';
const size = dev ? '' : ' — run `node dist/main.js` to verify';
console.log(`✓ Build complete: dist/main.js (${mode})${size}`);
