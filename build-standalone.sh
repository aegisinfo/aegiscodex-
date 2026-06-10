#!/usr/bin/env bash
set -euo pipefail

APP_NAME="aegis-cli"
VERSION="1.8.0"
DIST_DIR="dist/standalone"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Building standalone binaries for $APP_NAME v$VERSION ==="

# Step 1: Build the JS bundle with esbuild
echo "[1/5] Building JS bundle with esbuild..."
cd "$ROOT_DIR"
node esbuild.mjs

# Step 2: Create output directory
mkdir -p "$DIST_DIR"

# Step 3: Build Windows .exe
echo "[2/5] Building Windows .exe..."
npx pkg dist/main.js \
  --targets node22-win-x64 \
  --output "$DIST_DIR/$APP_NAME.exe" \
  --compress Brotli

# Step 4: Build Linux binary (for .deb)
echo "[3/5] Building Linux binary..."
npx pkg dist/main.js \
  --targets node22-linux-x64 \
  --output "$DIST_DIR/$APP_NAME-linux" \
  --compress Brotli

# Step 5: Build macOS binary
echo "[4/5] Building macOS binary..."
npx pkg dist/main.js \
  --targets node22-macos-x64 \
  --output "$DIST_DIR/$APP_NAME-macos" \
  --compress Brotli

# Step 6: Create .deb package
echo "[5/5] Creating .deb package..."
DEB_DIR="$DIST_DIR/deb-build/$APP_NAME_$VERSION-1_amd64"
mkdir -p "$DEB_DIR/DEBIAN"
mkdir -p "$DEB_DIR/usr/bin"
mkdir -p "$DEB_DIR/usr/share/doc/$APP_NAME"

# Control file
cat > "$DEB_DIR/DEBIAN/control" <<EOF
Package: $APP_NAME
Version: $VERSION
Section: utils
Priority: optional
Architecture: amd64
Maintainer: Niklas Borneklint <nborneklint@gmail.com>
Description: AEGIS CLI - An AI-powered coding assistant
 A CLI Coding Agent inspired by Claude Code that can read,
 write, and execute code to help with software engineering tasks.
Homepage: https://github.com/aegisinfo/aegiscode
EOF

# Install the binary
cp "$DIST_DIR/$APP_NAME-linux" "$DEB_DIR/usr/bin/$APP_NAME"
chmod 755 "$DEB_DIR/usr/bin/$APP_NAME"

# Copy license
cp -f "$ROOT_DIR/LICENSE" "$DEB_DIR/usr/share/doc/$APP_NAME/" 2>/dev/null || true

# Build .deb
dpkg-deb --build "$DEB_DIR" "$DIST_DIR/$APP_NAME_$VERSION-1_amd64.deb"

# Clean up build files
rm -rf "$DIST_DIR/deb-build"
rm -f "$DIST_DIR/$APP_NAME-linux"

# Summary
echo ""
echo "=== Build Complete ==="
echo ""
echo "Output in: $DIST_DIR/"
echo ""
ls -lh "$DIST_DIR/"
echo ""

# Verify
if [ -f "$DIST_DIR/$APP_NAME.exe" ]; then
  echo "✅ Windows: $DIST_DIR/$APP_NAME.exe"
fi
if [ -f "$DIST_DIR/$APP_NAME-macos" ]; then
  echo "✅ macOS:   $DIST_DIR/$APP_NAME-macos"
fi
if [ -f "$DIST_DIR/${APP_NAME}_${VERSION}-1_amd64.deb" ]; then
  echo "✅ Linux:   $DIST_DIR/${APP_NAME}_${VERSION}-1_amd64.deb"
fi
