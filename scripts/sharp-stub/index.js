// aegiscode only uses @xenova/transformers for text embeddings (all-MiniLM-L6-v2),
// never image inputs — so the real `sharp` native binary (and its install-time
// prebuild-install download, a recurring source of `npm install` failures on
// flaky networks/unsupported platforms) is unneeded dead weight. This stub
// satisfies `import sharp from 'sharp'` without pulling in native bindings.
function sharp() {
  throw new Error('sharp is stubbed out in aegiscode — image processing is not supported');
}
module.exports = sharp;
