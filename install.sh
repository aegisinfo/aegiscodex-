#!/bin/bash
set -euo pipefail

# install.sh — Downloads & installs the prebuilt aegis-cli binary for your platform.
# Supports: Linux x64/arm64, macOS x64/arm64, Windows x64 (via Git Bash/Cygwin)
#
# Usage:
#   curl -fsSL https://dl.aegiscloud.org/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/aegisinfo/aegiscode/main/install.sh | bash

INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${VERSION:-latest}"
BASE_URL="https://github.com/aegisinfo/aegiscode/releases/${VERSION}/download"

# ── Platform detection ──────────────────────────────────────────────────────

detect_binary() {
  local os arch key

  case "$(uname -s)" in
    Linux)  os="linux"  ;;
    Darwin) os="darwin" ;;
    MINGW*|MSYS*|CYGWIN*) os="win" ;;
    *)
      echo "❌ Unsupported OS: $(uname -s)"
      exit 1
      ;;
  esac

  case "$(uname -m)" in
    x86_64|amd64) arch="x64"   ;;
    aarch64|arm64) arch="arm64" ;;
    armv7l|armv8l) arch="arm64" ;;  # treat 32-bit ARM as arm64 fallback
    *)
      echo "❌ Unsupported architecture: $(uname -m)"
      exit 1
      ;;
  esac

  if [ "$os" = "win" ]; then
    echo "aegis-cli-win-x64.exe"
  else
    echo "aegis-cli-${os}-${arch}"
  fi
}

BINARY_NAME=$(detect_binary)
DOWNLOAD_URL="${BASE_URL}/${BINARY_NAME}"

# ── Install ─────────────────────────────────────────────────────────────────

echo "⬡ Installing aegis-cli for $(uname -s)-$(uname -m)..."

mkdir -p "$INSTALL_DIR"
TARGET="${INSTALL_DIR}/aegis"

# Download
echo "  Downloading ${DOWNLOAD_URL}..."
if command -v curl &>/dev/null; then
  curl -fsSL "$DOWNLOAD_URL" -o "$TARGET"
elif command -v wget &>/dev/null; then
  wget -q "$DOWNLOAD_URL" -O "$TARGET"
else
  echo "❌ Need curl or wget to download."
  exit 1
fi

chmod +x "$TARGET"

# ── PATH setup ──────────────────────────────────────────────────────────────

if ! echo "$PATH" | tr ':' '\n' | grep -qx "$INSTALL_DIR"; then
  SHELL_CONFIG=""
  case "${SHELL:-}" in
    */zsh) SHELL_CONFIG="$HOME/.zshrc" ;;
    */bash) SHELL_CONFIG="$HOME/.bashrc" ;;
  esac
  if [ -n "$SHELL_CONFIG" ] && [ -f "$SHELL_CONFIG" ]; then
    echo "export PATH=\"\$PATH:${INSTALL_DIR}\"" >> "$SHELL_CONFIG"
    echo "  ✅ Added ${INSTALL_DIR} to PATH in ${SHELL_CONFIG}"
  fi
  export PATH="${PATH}:${INSTALL_DIR}"
fi

# ── Config dir ──────────────────────────────────────────────────────────────

mkdir -p "$HOME/.aegiscode"

# ── Done ────────────────────────────────────────────────────────────────────

echo ""
echo "✓ aegis-cli installed to ${TARGET}"
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
