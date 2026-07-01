#!/bin/bash
set -euo pipefail

# install.sh — Installs aegiscode-cli with automatic Node.js setup.
#
# Usage:
#   curl -fsSL https://dl.aegiscloud.org/install.sh | bash

INSTALL_DIR="$HOME/.local/share/aegiscode-node"
NODE_VERSION="22.13.1"

# --- Auto-install Node.js 22 if not present or too old ---
install_node() {
  local arch
  local platform
  local url

  case "$(uname -m)" in
    x86_64)  arch="x64" ;;
    aarch64|arm64) arch="arm64" ;;
    *)       echo "❌ Unsupported architecture: $(uname -m)"; exit 1 ;;
  esac

  case "$(uname -s)" in
    Linux)   platform="linux" ;;
    Darwin)  platform="darwin" ;;
    *)       echo "❌ Unsupported OS: $(uname -s)"; exit 1 ;;
  esac

  url="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-${platform}-${arch}.tar.xz"

  echo "  Downloading Node.js ${NODE_VERSION} (${platform}/${arch})..."
  mkdir -p "$INSTALL_DIR"
  curl -fsSL "$url" | tar -xJ -C "$INSTALL_DIR" --strip-components=1

  export PATH="$INSTALL_DIR/bin:$PATH"
  echo "  Node.js $(node -v) installed to $INSTALL_DIR"

  # --- Symlink node/npm/npx to /usr/local/bin for ALL users ---
  if [ -w /usr/local/bin ]; then
    ln -sf "$INSTALL_DIR/bin/node" /usr/local/bin/node
    ln -sf "$INSTALL_DIR/bin/npm"  /usr/local/bin/npm
    ln -sf "$INSTALL_DIR/bin/npx"  /usr/local/bin/npx
    echo "  ✓ Symlinked node/npm/npx to /usr/local/bin (system-wide)"
  elif command -v sudo &>/dev/null; then
    sudo ln -sf "$INSTALL_DIR/bin/node" /usr/local/bin/node
    sudo ln -sf "$INSTALL_DIR/bin/npm"  /usr/local/bin/npm
    sudo ln -sf "$INSTALL_DIR/bin/npx"  /usr/local/bin/npx
    echo "  ✓ Symlinked node/npm/npx to /usr/local/bin (system-wide, via sudo)"
  else
    echo "  ⚠ Could not symlink to /usr/local/bin — add to your PATH:"
    echo "     export PATH=\"$INSTALL_DIR/bin:\$PATH\""
  fi
}

echo "⬡ Installing aegiscode-cli..."
echo ""

# Check Node.js version
if command -v node &>/dev/null; then
  NODE_VER="$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)"
  if [ "$NODE_VER" -lt 22 ]; then
    echo "  Node.js $(node -v) is too old (need >=22). Installing Node 22..."
    install_node
  else
    echo "  ✓ Node.js $(node -v) detected"
  fi
else
  echo "  Node.js not found. Installing Node 22..."
  install_node
fi

# Ensure npm is on PATH
if ! command -v npm &>/dev/null; then
  export PATH="$INSTALL_DIR/bin:$PATH"
fi

# --- Install the CLI (use Node 22's npm for global install) ---
echo "  Installing aegiscode..."
"$INSTALL_DIR/bin/npm" install -g aegiscode

# --- Create config directory ---
mkdir -p "$HOME/.aegiscode"

# --- Create .env template if none exists ---
ENV_FILE="$HOME/.aegiscode/.env"
CONFIG_FILE="$HOME/.aegiscode/config.json"

if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" << 'ENVEOF'
# ÆGIS Code — API Keys
# Uncomment and set at least one API key below.
# Create a free account at https://aegiscloud.org to get keys.
#
# ANTHROPIC (Claude models):
#ANTHROPIC_API_KEY=sk-ant-...
#
# DEEPSEEK (DeepSeek models):
#DEEPSEEK_API_KEY=sk-...
#
# GROQ (Groq models, fast inference):
#GROQ_API_KEY=gsk_...
#
# OPENAI (GPT models):
#OPENAI_API_KEY=sk-...
#
# AEGISCLOUD (pool key — prepaid credits, all models):
#AEGISCLOUD_API_KEY=aegis_...
#
# Memory token (optional — enables persistent memory):
#AEGIS_MEMORY_TOKEN=mem_...
ENVEOF
  echo "  ✓ Created $ENV_FILE (template — edit with your API keys)"
fi

# --- Create config.json default if none exists ---
if [ ! -f "$CONFIG_FILE" ]; then
  cat > "$CONFIG_FILE" << 'CONFIGEOF'
{
  "model": "claude-sonnet-4-6",
  "theme": "dark",
  "executeTime": false,
  "verbose": false
}
CONFIGEOF
  echo "  ✓ Created $CONFIG_FILE (default config)"
fi

# --- Detect claude CLI and suggest setup-token ---
if command -v claude &>/dev/null; then
  echo "  💡 Detected 'claude' CLI — run:  claude setup-token"
  echo "     Then authenticate with:       aegis login --claude-pro"
fi

# --- Welcome message ---
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║            ÆGIS Code — Installed!                  ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║                                                     ║"
echo "║  Start the CLI:      aegis                          ║"
echo "║                                                     ║"
echo "║  Set up API keys —                                   ║"
echo "║  edit the file:      nano ~/.aegiscode/.env         ║"
echo "║                                                     ║"
echo "║  Or let the wizard guide you:                       ║"
echo "║    aegis                                            ║"
echo "║    → Type /setup to configure API keys interactively ║"
echo "║                                                     ║"
echo "║  Quick commands:                                        ║"
echo "║    /model claude     — use Claude                       ║"
echo "║    /model deepseek   — use DeepSeek                     ║"
echo "║    /model groq       — use Groq                         ║"
echo "║    /council \"question\" — get 4-perspective analysis     ║"
echo "║    /memory           — recall past context              ║"
echo "║    /help             — show all commands                ║"
echo "║                                                     ║"
echo "║  Need help?   https://aegiscloud.org                    ║"
echo "║  Report bugs: https://github.com/aegisinfo/aegiscode    ║"
echo "║                                                     ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Tip: To load API keys automatically, add this to your ~/.bashrc:"
echo "    source ~/.aegiscode/.env"
echo ""
