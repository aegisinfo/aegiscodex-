#!/bin/bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$(which node 2>/dev/null || which nodejs 2>/dev/null)"

echo "⬡ Installing aegiscode..."

# Check node
if [ -z "$NODE_BIN" ]; then
  echo "  ❌ Node.js not found. Install via: https://nodejs.org or nvm"
  exit 1
fi

NODE_VER=$($NODE_BIN -v 2>/dev/null | sed 's/v//' || echo "0")
NODE_MIN="22.0.0"
if [ "$(printf '%s\n' "$NODE_MIN" "$NODE_VER" | sort -V | head -n1)" != "$NODE_MIN" ]; then
  echo "  ❌ Node.js >= $NODE_MIN required (got v$NODE_VER)"
  echo "  Install via: https://nodejs.org or nvm"
  exit 1
fi

cd "$DIR"

# Two distributions ship this same script:
#  - source clone: no prebuilt bundle yet, needs `npm install && npm run build`
#    (esbuild.mjs/src/ are present)
#  - release zip from dl.aegiscloud.org: already has aegiscode.js prebuilt and
#    node_modules installed (done in CI), but no esbuild.mjs/src/ to build from
if [ -f "$DIR/aegiscode.js" ]; then
  ENTRY="$DIR/aegiscode.js"
  if [ ! -d "$DIR/node_modules" ]; then
    echo "  Installing dependencies..."
    npm install --silent --omit=dev
  fi
else
  ENTRY="$DIR/dist/main.js"
  echo "  Installing dependencies..."
  npm install --silent

  echo "  Building..."
  npm run build
fi

# Create config dir
mkdir -p "$HOME/.aegiscode"

# Create wrapper — always cd to project dir so .env loads correctly
mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/aegis" << WRAPPER
#!/bin/bash
cd "$DIR"
exec "$NODE_BIN" "$ENTRY" "\$@"
WRAPPER
chmod +x "$HOME/.local/bin/aegis"

# Add to PATH
if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
  echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> ~/.bashrc
  export PATH="$HOME/.local/bin:$PATH"
fi

echo ""
echo "✓ aegiscode installed"
echo ""
echo "  Run:          aegis"
echo "  Switch model: /model claude | /model deepseek | /model groq"
echo "  Council:      /council \"your question\""
echo "  Memory:       /memory"
echo ""
echo "  Add API keys to: $DIR/.env"
echo "    ANTHROPIC_API_KEY=sk-ant-..."
echo "    DEEPSEEK_API_KEY=sk-..."
echo "    GROQ_API_KEY=gsk_..."
echo "    AEGISCLOUD_API_KEY=aegis_..."
echo ""
echo "  More info: https://aegiscloud.org"
