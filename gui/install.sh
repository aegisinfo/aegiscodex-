#!/bin/bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "⬡ Installing AEGIS Code (desktop)..."

# Check electron dependency
ELECTRON_BIN="$DIR/node_modules/electron/dist/electron"

if [ ! -f "$ELECTRON_BIN" ]; then
  echo "  Installing dependencies..."
  cd "$DIR"
  npm install --silent
fi

if [ ! -f "$ELECTRON_BIN" ]; then
  echo "  ❌ Electron not found after install. Try: cd gui && npm install"
  exit 1
fi

# Create config dir
mkdir -p "$HOME/.aegiscode"

# Create ags launcher
mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/ags" << WRAPPER
#!/bin/bash
rm -f "\$HOME/.config/aegiscode-gui/SingletonLock" \\
      "\$HOME/.config/aegiscode-gui/SingletonCookie" \\
      "\$HOME/.config/aegiscode-gui/SingletonSocket" 2>/dev/null
exec "$ELECTRON_BIN" --no-sandbox "$DIR" "\$@"
WRAPPER
chmod +x "$HOME/.local/bin/ags"

# Add ~/.local/bin to PATH if needed
if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
  echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> ~/.bashrc
  export PATH="$HOME/.local/bin:$PATH"
fi

echo ""
echo "✓ AEGIS Code installed"
echo ""
echo "  Run:     ags"
echo ""
echo "  On first launch, go to Settings to add your API key."
echo "  Memory & cloud sync: paste your API key in the Memory tab."
echo ""
echo "  More info: https://aegiscloud.org"
