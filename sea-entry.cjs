const { createRequire } = require('module');
const { pathToFileURL } = require('url');
const path = require('path');

// Bootstrap ESM from CJS
(async () => {
  const mainPath = path.join(__dirname, 'dist', 'main.js');
  await import(pathToFileURL(mainPath).href);
})();
