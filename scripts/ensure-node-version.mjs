#!/usr/bin/env node
/**
 * Preinstall hook — checks Node >= 22 and guides toward automatic upgrade.
 * Full auto-install: curl -fsSL https://raw.githubusercontent.com/aegisinfo/aegiscode/main/scripts/install.sh | sh
 */

const MIN_MAJOR = 18;
const currentMajor = parseInt(process.version.slice(1), 10);

if (currentMajor >= MIN_MAJOR) {
  process.exit(0);
}

console.error(`
╔══════════════════════════════════════════════════════════╗
║  ⚠️  Node.js ${process.version} detected — AEGIS CLI needs Node >= ${MIN_MAJOR}      ║
╠══════════════════════════════════════════════════════════╣
║  Auto-install (recommended):                            ║
║    curl -fsSL https://aegiscode.dev/install.sh | sh     ║
║                                                          ║
║  Manual upgrade (Linux):                                 ║
║    curl -fsSL https://deb.nodesource.com/setup_22.x |   ║
║      sudo -E bash -                                      ║
║    sudo apt-get install -y nodejs                        ║
╚══════════════════════════════════════════════════════════╝
`);
process.exit(1);
