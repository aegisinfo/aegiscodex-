import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/main.tsx'],
  outfile: 'dist/main.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: false,
  external: ['sql.js', '@xenova/transformers'],
  banner: {
    js: `#!/usr/bin/env node
import __aegis_mod from'node:module';if(typeof require==='undefined'){globalThis.require=__aegis_mod.createRequire(import.meta.url);}
`,
  },
  minifyWhitespace: false,
  minifyIdentifiers: false,
  minifySyntax: false,
});

console.log('✓ Build complete (11.10 MB)');
