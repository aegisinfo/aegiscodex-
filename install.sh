#!/bin/bash
set -euo pipefail

# install.sh — Installs aegiscode-cli + auto-configures everything.
#
# Usage:
#   curl -fsSL https://dl.aegiscloud.org/install.sh | bash
#
# What it does:
#   1. Installs Node.js 22+ if missing
#   2. npm install -g aegiscode-cli → `aegis` command
#   3. Creates ~/.aegiscode/ with default config and env template
#   4. Guides you through Claude Pro token setup if applicable
#
# After install, just run: aegis

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${CYAN}⬡ ${BOLD}AEGIS${NC} — Installing aegiscode-cli..."
echo ""

# ── 1. Install Node.js 22+ if missing ────────────────────────────────
if ! command -v node &>/dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" -lt 22 ]; then
  echo -e "${YELLOW}⟳ Installing Node.js 22...${NC}"
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64)  NODE_ARCH="x64" ;;
    aarch64|arm64) NODE_ARCH="arm64" ;;
    *) echo -e "${RED}Unsupported architecture: $ARCH${NC}"; exit 1 ;;
  esac

  case "$(uname -s)" in
    Linux)  NODE_OS="linux" ;;
    Darwin) NODE_OS="darwin" ;;
    *) echo -e "${RED}Unsupported OS${NC}"; exit 1 ;;
  esac

  NODE_VERSION="22.13.1"
  NODE_DIR="$HOME/.local/share/aegiscode-node"
  mkdir -p "$NODE_DIR"

  if [ ! -f "$NODE_DIR/current/bin/node" ]; then
    echo "  Downloading Node.js ${NODE_VERSION} (${NODE_OS}-${NODE_ARCH})..."
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-${NODE_OS}-${NODE_ARCH}.tar.xz" \
      | tar -xJ -C "$NODE_DIR" --strip-components=1 -f -
    mv "$NODE_DIR/bin/node" "$NODE_DIR/current/" 2>/dev/null || true
  fi

  export PATH="$NODE_DIR/current/bin:$PATH"
  echo -e "  ${GREEN}✓${NC} Node.js $(node -v) installed to ${BOLD}$NODE_DIR/current/bin${NC}"
  echo -e "  ${YELLOW}Tip:${NC} Add to ~/.bashrc → ${BOLD}export PATH=\"\$NODE_DIR/current/bin:\$PATH\"${NC}"
  echo ""
fi

# ── 2. Install aegiscode-cli ─────────────────────────────────────────
if ! command -v npm &>/dev/null; then
  echo -e "${RED}❌ npm not found${NC}"
  exit 1
fi

NPM_PREFIX="$(npm config get prefix 2>/dev/null || true)"
if [ -n "$NPM_PREFIX" ] && [ -w "$NPM_PREFIX" ]; then
  npm install -g aegiscode-cli
else
  echo -e "  ${YELLOW}Need elevated permissions for npm global install, using sudo...${NC}"
  sudo npm install -g aegiscode-cli
fi

# ── 3. Create ~/.aegiscode/ — config directory ───────────────────────
mkdir -p "$HOME/.aegiscode"

# Create default config.json if none exists
if [ ! -f "$HOME/.aegiscode/config.json" ]; then
  cat > "$HOME/.aegiscode/config.json" << 'CONFIGEOF'
{
  "default": {
    "model": "claude-sonnet-4-6"
  },
  "ui": {
    "theme": "dark"
  },
  "mcpEnabled": true
}
CONFIGEOF
  echo -e "  ${GREEN}✓${NC} Created default config at ${BOLD}~/.aegiscode/config.json${NC}"
fi

# Create .env template if none exists
if [ ! -f "$HOME/.aegiscode/.env" ]; then
  cat > "$HOME/.aegiscode/.env" << 'ENVEOF'
# aegiscode — API Keys
# Add at least one model key to get started.
# Then run `aegis` — the first launch will test connectivity.

# ── Model API keys (at least one needed) ──────────────────────
# Anthropic (Claude models):
#   ANTHROPIC_API_KEY=sk-ant-...
# DeepSeek:
#   DEEPSEEK_API_KEY=sk-...
# Groq (fast, free-tier models):
#   GROQ_API_KEY=gsk_...
# OpenAI:
#   OPENAI_API_KEY=sk-...

# ── Cloud sync & memory (optional) ────────────────────────────
# Get your key at https://aegiscloud.org/account → Settings
# AEGISCLOUD_API_KEY=aegis_...
#
# Semantic memory ($2/month):
# AEGIS_MEMORY_TOKEN=

# ── Claude Code Pro/Max subscription (optional) ───────────────
# Run: claude setup-token
# Then add the token here:
# CLAUDE_CODE_OAUTH_TOKEN=
ENVEOF
  echo -e "  ${GREEN}✓${NC} Created env template at ${BOLD}~/.aegiscode/.env${NC}"
fi

# ── 4. Claude Code Pro/Max token setup ────────────────────────────────
if command -v claude &>/dev/null; then
  if ! grep -q 'CLAUDE_CODE_OAUTH_TOKEN' "$HOME/.aegiscode/.env" 2>/dev/null \
     || grep -q 'CLAUDE_CODE_OAUTH_TOKEN=$' "$HOME/.aegiscode/.env" 2>/dev/null; then
    echo ""
    echo -e "${CYAN}◆ Claude Code CLI detected${NC}"
    echo -e "  Want to use your ${BOLD}Claude Pro/Max subscription${NC} instead of an API key?"
    echo -e "  Run:  ${BOLD}claude setup-token${NC}"
    echo -e "  Then: ${BOLD}aegis login --claude-pro${NC}"
  fi
fi

# ── 5. Run aegis --init to populate defaults (only if --init passed)  ──
# aegis --init is handled separately since its SetupWizard is interactive

echo ""
echo -e "${GREEN}${BOLD}✓ aegiscode-cli installed${NC}"
echo ""

# Detect terminal width for nice formatting
COLS=$(tput cols 2>/dev/null || echo 60)
SEP=$(printf '%*s' "$COLS" | tr ' ' '─')

echo -e "  ${BOLD}Run it:${NC}       ${CYAN}aegis${NC}"
echo -e "  ${BOLD}Switch model:${NC}  /model claude | /model deepseek | /model groq"
echo -e "  ${BOLD}Council:${NC}       /council \"your question\""
echo -e "  ${BOLD}Memory:${NC}        /memory"
echo -e "  ${BOLD}CLI help:${NC}      aegis --help"
echo ""
echo -e "  ${SEP}"
echo ""

# ── 6. First-run guidance ─────────────────────────────────────────────
echo -e "  ${YELLOW}${BOLD}First run?${NC} Just type ${CYAN}aegis${NC} and the interactive"
echo -e "  SetupWizard will guide you through API keys, memory, and more."
echo ""
echo -e "  Or set your keys manually:"
echo -e "    ${BOLD}edit ~/.aegiscode/.env${NC}          (API keys template)"
echo -e "    ${BOLD}edit ~/.aegiscode/config.json${NC}   (model, theme, MCP)"
echo ""
echo -e "  Cloud account & memory token:"
echo -e "    ${BOLD}https://aegiscloud.org/account${NC}"
echo ""
echo -e "  ${SEP}"
echo ""
echo -e "  ${YELLOW}Pro tip:${NC} Try the auto-router on first launch:"
echo -e "    ${CYAN}aegis --router${NC}"
echo ""
