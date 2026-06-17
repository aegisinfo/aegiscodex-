#!/usr/bin/env bash
# AEGIS Code — installer
# Usage: curl -fsSL https://aegiscloud.org/install.sh | bash
set -euo pipefail

R2="https://pub-a975e7eee93c4432a2bf952f50705bf1.r2.dev"
OS="$(uname -s)"

log()  { printf "\033[0;36m⬡\033[0m  %s\n" "$*"; }
ok()   { printf "\033[0;32m✓\033[0m  %s\n" "$*"; }
err()  { printf "\033[0;31m✗\033[0m  %s\n" "$*" >&2; exit 1; }
warn() { printf "\033[0;33m!\033[0m  %s\n" "$*"; }

# ── Check / install Node >= 20 ────────────────────────────────────────────────
need_node() {
  local ver
  if command -v node &>/dev/null; then
    ver="$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')"
    [ "$ver" -ge 20 ] && return 0
    warn "Found Node.js v$(node --version | tr -d v) — need >= 20, will install Node 22."
  fi
  return 1
}

install_node_linux() {
  log "Installing Node.js 22..."
  if command -v curl &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  else
    wget -qO- https://deb.nodesource.com/setup_22.x | sudo -E bash -
  fi
  sudo apt-get install -y nodejs
  ok "Node.js $(node --version) installed"
}

install_node_mac() {
  log "Installing Node.js 22 via Homebrew..."
  if ! command -v brew &>/dev/null; then
    err "Homebrew not found. Install from https://brew.sh, then rerun this script."
  fi
  brew install node@22
  brew link --overwrite node@22 --force
  ok "Node.js $(node --version) installed"
}

# ── Linux ─────────────────────────────────────────────────────────────────────
install_linux() {
  if ! command -v dpkg &>/dev/null; then
    err "dpkg not found — this installer supports Debian/Ubuntu. Download manually from aegiscloud.org."
  fi

  need_node || install_node_linux

  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT

  log "Downloading AEGIS Code..."
  local deb="$tmp/aegiscode-gui.deb"
  if command -v curl &>/dev/null; then
    curl -fsSL --progress-bar "$R2/aegiscode-gui.deb" -o "$deb"
  else
    wget -q --show-progress "$R2/aegiscode-gui.deb" -O "$deb"
  fi

  log "Installing..."
  sudo dpkg -i "$deb" || sudo apt-get install -f -y

  ok "AEGIS Code installed"
  echo ""
  echo "  Launch:  AEGIS Code  (application menu)"
  echo ""
  echo "  Free to start  ·  €2/mo Pro (vs Claude Code $20/mo · Cursor $20/mo)"
  echo "  Get cross-session memory at aegiscloud.org/#pricing"
  echo ""
  echo "  1,200+ developers already upgraded"
  echo "  aegiscloud.org"
}

# ── macOS ─────────────────────────────────────────────────────────────────────
install_mac() {
  need_node || install_node_mac

  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT

  log "Downloading AEGIS Code..."
  local dmg="$tmp/aegiscode-gui.dmg"
  curl -fsSL --progress-bar "$R2/aegiscode-gui.dmg" -o "$dmg"

  log "Mounting disk image..."
  local mnt
  mnt="$(hdiutil attach "$dmg" -nobrowse -noautoopen | awk '/\/Volumes\//{print $NF}')"

  log "Copying to /Applications..."
  cp -R "$mnt"/*.app /Applications/
  hdiutil detach "$mnt" -quiet

  ok "AEGIS Code installed in /Applications"
  echo ""
  echo "  Launch from Spotlight or Applications folder."
  echo ""
  echo "  Free to start  ·  €2/mo Pro (vs Claude Code $20/mo · Cursor $20/mo)"
  echo "  Get cross-session memory at aegiscloud.org/#pricing"
  echo ""
  echo "  1,200+ developers already upgraded"
  echo "  aegiscloud.org"
}

# ── Main ──────────────────────────────────────────────────────────────────────
echo ""
echo "  \033[0;36mÆGIS Code\033[0m — installer"
echo "  \033[0;90mFree to start · €2/mo Pro (vs Claude Code \$20/mo · Cursor \$20/mo)\033[0m"
echo "  \033[0;90mCross-session memory · 1,200+ developers already on Pro\033[0m"
echo ""

case "$OS" in
  Linux)  install_linux ;;
  Darwin) install_mac ;;
  *)      err "Unsupported OS: $OS. Download manually from aegiscloud.org." ;;
esac
