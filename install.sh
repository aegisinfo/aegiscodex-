#!/bin/bash
set -e

echo "⬡ Installing aegiscode..."

NODE_BIN="$(which node 2>/dev/null || which nodejs 2>/dev/null)"
if [ -z "$NODE_BIN" ]; then
  echo "  ❌ Node.js not found. Install via: https://nodejs.org or nvm"
  exit 1
fi

NODE_VER=$($NODE_BIN -v | sed 's/v//')
NODE_MIN="22.0.0"
if [ "$(printf '%s\n' "$NODE_MIN" "$NODE_VER" | sort -V | head -n1)" != "$NODE_MIN" ]; then
  echo "  ❌ Node.js >= $NODE_MIN required (got v$NODE_VER)"
  exit 1
fi

INSTALL_DIR="$HOME/.aegiscode/app"
mkdir -p "$INSTALL_DIR"

echo "  Downloading latest release..."
curl -fsSL https://github.com/aegisinfo/aegiscode/releases/latest/download/aegiscode-release.zip -o /tmp/aegiscode-release.zip
unzip -o /tmp/aegiscode-release.zip -d /tmp/aegiscode-extract
cp -r /tmp/aegiscode-extract/release/. "$INSTALL_DIR/"
rm -rf /tmp/aegiscode-release.zip /tmp/aegiscode-extract

mkdir -p "$HOME/.aegiscode"
if [ ! -f "$HOME/.aegiscode/.env" ]; then
  cat > "$HOME/.aegiscode/.env" << ENVEOF
ANTHROPIC_API_KEY=
DEEPSEEK_API_KEY=
GROQ_API_KEY=
AEGISCLOUD_API_KEY=
ENVEOF
  echo "  Created ~/.aegiscode/.env — add your API keys there"
fi

if [ ! -f "$HOME/.aegiscode/config.json" ]; then
  cat > "$HOME/.aegiscode/config.json" << CONFIGEOF
{
  "default": { "model": "deepseek-chat", "baseURL": "https://api.deepseek.com/v1" },
  "ui": { "theme": "dark" },
  "mcpEnabled": false,
  "mcpServers": {},
  "models": [
    { "id": "claude", "name": "Claude Sonnet 4.6", "model": "claude-sonnet-4-6", "baseURL": "https://api.anthropic.com/v1" },
    { "id": "deepseek", "name": "DeepSeek Chat", "model": "deepseek-chat", "baseURL": "https://api.deepseek.com/v1" },
    { "id": "groq", "name": "Groq Llama 3.3", "model": "llama-3.3-70b-versatile", "baseURL": "https://api.groq.com/openai/v1" },
    { "id": "ollama", "name": "Ollama (local)", "model": "qwen2.5-coder:1.5b", "baseURL": "http://localhost:11434/v1", "apiKey": "ollama" }
  ],
  "currentModelId": "deepseek"
}
CONFIGEOF
fi

mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/aegis" << WRAPPER
#!/bin/bash
exec "$NODE_BIN" --no-deprecation "$INSTALL_DIR/aegiscode.js" "\$@"
WRAPPER
chmod +x "$HOME/.local/bin/aegis"

if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
  echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> ~/.bashrc
  export PATH="$HOME/.local/bin:$PATH"
fi

echo ""
echo "✓ aegiscode installed"
echo ""
echo "  Run:     aegis"
echo "  Memory:  /memory activate <token>"
echo "  Keys:    ~/.aegiscode/.env"
echo ""
echo "  More info: https://aegiscloud.org/aegiscode"

