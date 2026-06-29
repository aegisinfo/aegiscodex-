#!/usr/bin/env bash
set -euo pipefail

REPO="aegisinfo/aegiscode"
PACKAGE="aegiscode"
MIN_NODE_MAJOR=22

# ── Colors ──────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; NC='\033[0m'

log()  { echo -e "${CYAN}→${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1"; exit 1; }

# ── Detect Node.js ──────────────────────────────────────
detect_node() {
  if command -v node &>/dev/null; then
    NODE_VERSION=$(node -v | sed 's/^v//')
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    log "Node.js ${NODE_VERSION} detected"
    return 0
  fi
  return 1
}

# ── Install Node.js 22 ──────────────────────────────────
install_node() {
  warn "Node.js >= ${MIN_NODE_MAJOR} required (found ${NODE_VERSION:-none})"
  log "Installing Node.js ${MIN_NODE_MAJOR}..."

  # Strategy: nvm
  if [ -n "${NVM_DIR:-}" ] || [ -f "$HOME/.nvm/nvm.sh" ]; then
    NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    log "Using nvm..."
    \. "$NVM_DIR/nvm.sh"
    nvm install "$MIN_NODE_MAJOR"
    nvm alias default "$MIN_NODE_MAJOR"
    ok "Node.js $(node -v) installed via nvm"
    return 0
  fi

  # Strategy: fnm
  if command -v fnm &>/dev/null; then
    log "Using fnm..."
    fnm install "$MIN_NODE_MAJOR"
    fnm default "$MIN_NODE_MAJOR"
    eval "$(fnm env)"
    ok "Node.js $(node -v) installed via fnm"
    return 0
  fi

  # Strategy: nodesource (Linux)
  if [ "$(uname -s)" = "Linux" ]; then
    log "Using nodesource..."
    curl -fsSL "https://deb.nodesource.com/setup_${MIN_NODE_MAJOR}.x" | sudo -E bash -
    sudo apt-get install -y nodejs
    ok "Node.js $(node -v) installed via nodesource"
    return 0
  fi

  # Strategy: brew (macOS)
  if command -v brew &>/dev/null; then
    log "Using Homebrew..."
    brew install node@${MIN_NODE_MAJOR}
    brew link --overwrite node@${MIN_NODE_MAJOR}
    ok "Node.js $(node -v) installed via Homebrew"
    return 0
  fi

  err "Could not auto-install Node.js. Install manually:\n  curl -fsSL https://deb.nodesource.com/setup_${MIN_NODE_MAJOR}.x | sudo -E bash -\n  sudo apt-get install -y nodejs"
}

# ── Fix npm prefix (avoid EACCES) ───────────────────────
fix_npm_prefix() {
  if [ "$(npm config get prefix)" = "/usr/local" ]; then
    if [ ! -w "/usr/local/lib/node_modules" ]; then
      warn "No write permission for /usr/local/lib/node_modules"
      log "Configuring npm to use ~/.npm-global..."
      mkdir -p "$HOME/.npm-global"
      npm config set prefix "$HOME/.npm-global"
      # Add to PATH if not already there
      case ":$PATH:" in
        *:"$HOME/.npm-global/bin":*) ;;
        *)
          echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> "$HOME/.bashrc"
          echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> "$HOME/.profile"
          export PATH="$HOME/.npm-global/bin:$PATH"
          ;;
      esac
      ok "npm prefix set to ~/.npm-global"
    fi
  fi
}

# ── Main ────────────────────────────────────────────────
echo
echo "  ${CYAN}━━━ AEGIS CLI Installer ━━━${NC}"
echo

detect_node || NODE_MAJOR=0

if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
  install_node
  # Re-source PATH in case nvm/fnm added node
  export PATH="$HOME/.npm-global/bin:$PATH"
fi

fix_npm_prefix

log "Installing ${PACKAGE}..."
npm install -g "${PACKAGE}@latest" 2>/dev/null || npm install -g "${PACKAGE}@latest" --no-optional

echo
if command -v aegis &>/dev/null; then
  ok "AEGIS CLI installed! Run: aegis --help"
else
  warn "Add ~/.npm-global/bin to your PATH, then run: aegis --help"
fi
echo
