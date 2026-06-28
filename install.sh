#!/bin/bash
set -euo pipefail

# install.sh — Installs aegiscode-cli via npm.
# Auto-installs Node.js >=22 if missing or too old.
#
# Usage:
#   curl -fsSL https://dl.aegiscloud.org/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/aegisinfo/aegiscode/main/install.sh | bash

NODE_MIN_MAJOR=22

# ---- Node.js version check & auto-install ----
ensure_node() {
  local install_node=0

  if ! command -v node &>/dev/null; then
    echo "◌ Node.js not found — will install..."
    install_node=1
  else
    local current
    current="$(node --version | sed 's/^v//; s/\..*//')"
    if [ "$current" -lt "$NODE_MIN_MAJOR" ] 2>/dev/null; then
      echo "◌ Node.js $(node --version) is too old (need >=$NODE_MIN_MAJOR) — upgrading..."
      install_node=1
    fi
  fi

  if [ "$install_node" -eq 1 ]; then
    local os arch url install_dir node_dir
    os="$(uname -s | tr '[:upper:]' '[:lower:]')"
    arch="$(uname -m)"

    case "$os" in
      linux)  os="linux" ;;
      darwin) os="darwin" ;;
      *)      echo "❌ Unsupported OS: $os"; exit 1 ;;
    esac
    case "$arch" in
      x86_64|amd64) arch="x64" ;;
      aarch64|arm64) arch="arm64" ;;
      *)            echo "❌ Unsupported arch: $arch"; exit 1 ;;
    esac

    install_dir="$HOME/.local/share/aegiscode-node"
    mkdir -p "$install_dir"

    echo "◌ Downloading Node.js ${NODE_MIN_MAJOR} for ${os}-${arch}..."
    url="https://nodejs.org/dist/v${NODE_MIN_MAJOR}.0.0/node-v${NODE_MIN_MAJOR}.0.0-${os}-${arch}.tar.xz"

    # Download with progress
    if command -v curl &>/dev/null; then
      curl -fsSL "$url" -o /tmp/node.tar.xz
    elif command -v wget &>/dev/null; then
      wget -q "$url" -O /tmp/node.tar.xz
    else
      echo "❌ Need curl or wget to download Node.js"; exit 1
    fi

    echo "◌ Extracting..."
    tar -xf /tmp/node.tar.xz -C "$install_dir"
    rm -f /tmp/node.tar.xz

    node_dir="$(ls -d "$install_dir"/node-v* 2>/dev/null | head -1)"
    if [ -z "$node_dir" ]; then
      echo "❌ Extraction failed — no node-v* directory found in $install_dir"; exit 1
    fi

    # Symlink so PATH addition works cleanly
    ln -sf "$node_dir" "$install_dir/current"

    # Add to PATH for the rest of this script
    export PATH="$install_dir/current/bin:$PATH"

    echo "✓ Node.js $(node --version) installed at $install_dir/current"

    # Warn user to add to their shell profile
    if ! echo "$PATH" | grep -q "$install_dir/current/bin"; then
      echo ""
      echo "  ⚠ To make Node.js permanent, add to your shell profile:"
      echo "    echo 'export PATH=\"\$HOME/.local/share/aegiscode-node/current/bin:\$PATH\"' >> ~/.bashrc"
      echo ""
    fi
  fi
}

ensure_node

# ---- npm / corepack sanity ----
if ! command -v npm &>/dev/null; then
  echo "❌ npm not found even after Node.js install."; exit 1
fi

echo ""
echo "⬡ Installing aegiscode-cli..."

NPM_PREFIX="$(npm config get prefix 2>/dev/null || true)"
if [ -n "$NPM_PREFIX" ] && [ -w "$NPM_PREFIX" ]; then
  npm install -g aegiscode-cli
else
  echo "  Need elevated permissions for npm global install, using sudo..."
  sudo npm install -g aegiscode-cli
fi

mkdir -p "$HOME/.aegiscode"

echo ""
echo "✓ aegiscode-cli installed"
echo ""
echo "  Run:          aegis"
echo "  Switch model: /model claude | /model deepseek | /model groq"
echo "  Council:      /council \"your question\""
echo "  Memory:       /memory"
echo ""
echo "  Set API keys (one of):"
echo "    export ANTHROPIC_API_KEY=sk-ant-..."
echo "    export DEEPSEEK_API_KEY=sk-..."
echo "    export OPENAI_API_KEY=sk-..."
echo "    export AEGISCLOUD_API_KEY=aegis_..."
echo ""
echo "  Or create ~/.aegiscode/config.json"
echo ""
echo "  More info: https://aegiscloud.org"
