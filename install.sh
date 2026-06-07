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
echo "  Installing dependencies..."
npm install --silent

echo "  Building..."
npm run build

# Create config dir and default config
mkdir -p "$HOME/.aegiscode"
if [ ! -f "$HOME/.aegiscode/config.json" ]; then
  cat > "$HOME/.aegiscode/config.json" << CONFIGEOF
{
  "default": {
    "model": "deepseek-chat",
    "baseURL": "https://api.deepseek.com/v1"
  },
  "ui": { "theme": "dark" },
  "mcpEnabled": false,
  "mcpServers": {},
  "models": [
    {
      "id": "claude",
      "name": "Claude Sonnet 4.6",
      "model": "claude-sonnet-4-6",
      "baseURL": "https://api.anthropic.com/v1"
    },
    {
      "id": "deepseek",
      "name": "DeepSeek Chat",
      "model": "deepseek-chat",
      "baseURL": "https://api.deepseek.com/v1"
    },
    {
      "id": "groq",
      "name": "Groq Llama 3.3",
      "model": "llama-3.3-70b-versatile",
      "baseURL": "https://api.groq.com/openai/v1"
    },
    {
      "id": "ollama",
      "name": "Ollama (local)",
      "model": "qwen2.5-coder:1.5b",
      "baseURL": "http://localhost:11434/v1",
      "apiKey": "ollama"
    }
  ],
  "currentModelId": "deepseek"
}
CONFIGEOF
  echo "  Created default config: ~/.aegiscode/config.json"
fi

# Create .env template in ~/.aegiscode if it doesn't exist
if [ ! -f "$HOME/.aegiscode/.env" ]; then
  cat > "$HOME/.aegiscode/.env" << ENVEOF
# aegiscode — API keys
# Add keys for the providers you want to use

ANTHROPIC_API_KEY=
DEEPSEEK_API_KEY=
GROQ_API_KEY=
AEGISCLOUD_API_KEY=
ENVEOF
  echo "  Created ~/.aegiscode/.env — add your API keys there"
fi

# Create wrapper — reads .env from ~/.aegiscode/.env
mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/aegis" << WRAPPER
#!/bin/bash
exec "$NODE_BIN" "$DIR/dist/main.js" "\$@"
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
echo "  Switch model: /model claude | /model deepseek | /model groq | /model ollama"
echo "  Multi-agent:  /multi <task>"
echo "  Council:      /council <question>"
echo "  Research:     /research <topic>"
echo "  Memory:       /memory activate <token>"
echo ""
echo "  Add API keys to: ~/.aegiscode/.env"
echo "    ANTHROPIC_API_KEY=sk-ant-..."
echo "    DEEPSEEK_API_KEY=sk-..."
echo "    GROQ_API_KEY=gsk_..."
echo ""
echo "  More info: https://aegiscloud.org/aegiscode"
