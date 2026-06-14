#!/bin/bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "⬡ Installing AEGIS Code (desktop)..."

# macOS Electron binary has a different path
if [ "$(uname)" = "Darwin" ]; then
  ELECTRON_BIN="$DIR/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
else
  ELECTRON_BIN="$DIR/node_modules/electron/dist/electron"
fi

if [ ! -f "$ELECTRON_BIN" ]; then
  echo "  Installing dependencies..."
  (cd "$DIR" && npm install --silent)
fi

if [ ! -f "$ELECTRON_BIN" ]; then
  echo "  ❌ Electron not found after install. Try: cd gui && npm install"
  exit 1
fi

# Create config dir
mkdir -p "$HOME/.aegiscode"

# Determine launcher destination — prefer ~/.local/bin, fall back to ~/bin (macOS)
if [ "$(uname)" = "Darwin" ]; then
  LAUNCH_DIR="$HOME/.local/bin"
  mkdir -p "$LAUNCH_DIR"
else
  LAUNCH_DIR="$HOME/.local/bin"
  mkdir -p "$LAUNCH_DIR"
fi

cat > "$LAUNCH_DIR/ags" << WRAPPER
#!/bin/bash
# Clear stale Electron singleton locks
rm -f "\$HOME/.config/aegiscode-gui/SingletonLock" \\
      "\$HOME/.config/aegiscode-gui/SingletonCookie" \\
      "\$HOME/.config/aegiscode-gui/SingletonSocket" 2>/dev/null
exec "$ELECTRON_BIN" --no-sandbox "$DIR" "\$@"
WRAPPER
chmod +x "$LAUNCH_DIR/ags"

# Add to PATH in shell rc files if needed
add_to_path() {
  local rc="$1"
  if [ -f "$rc" ] && ! grep -q "$LAUNCH_DIR" "$rc" 2>/dev/null; then
    echo "export PATH=\"$LAUNCH_DIR:\$PATH\"" >> "$rc"
  fi
}

if ! echo "$PATH" | grep -q "$LAUNCH_DIR"; then
  add_to_path "$HOME/.bashrc"
  add_to_path "$HOME/.zshrc"
  add_to_path "$HOME/.profile"
  export PATH="$LAUNCH_DIR:$PATH"
  echo "  Added $LAUNCH_DIR to PATH"
fi

echo ""
echo "  ✓ AEGIS Code installed"
echo ""
echo "  Run:   ags"
echo ""
echo "  On first launch, go to Settings to add your API key."
echo "  Memory & cloud sync: paste your API key in the Memory tab."
echo ""
echo "  More info: https://aegiscloud.org"
