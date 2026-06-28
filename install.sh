#!/bin/bash
set -euo pipefail

# install.sh — Installs aegiscode-cli via npm.
#
# Usage:
#   curl -fsSL https://dl.aegiscloud.org/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/aegisinfo/aegiscode/main/install.sh | bash

echo "⬡ Installing aegiscode-cli..."

if ! command -v npm &>/dev/null; then
  echo "❌ npm not found. Install Node.js (>=22) first: https://nodejs.org"
  exit 1
fi

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
