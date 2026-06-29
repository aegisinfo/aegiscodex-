#!/usr/bin/env bash
set -euo pipefail

APP_NAME="aegis-cli"
VERSION="4.0.3"
DIST_DIR="dist/standalone"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Building standalone binaries for $APP_NAME v$VERSION ==="

# Step 1: Build the JS bundle with esbuild (CJS format for pkg compatibility)
echo "[1/5] Building JS bundle with esbuild (CJS)..."
cd "$ROOT_DIR"
node esbuild.mjs --cjs

# Step 2: Create output directory
mkdir -p "$DIST_DIR"

# Step 3: Build Windows .exe
echo "[2/5] Building Windows .exe..."
npx pkg dist/sea-entry.cjs \
  --targets node22-win-x64 \
  --output "$DIST_DIR/$APP_NAME-win-x64.exe" \
  --compress Brotli

# Step 4: Build Linux binaries
echo "[3/5] Building Linux x64 binary..."
npx pkg dist/sea-entry.cjs \
  --targets node22-linux-x64 \
  --output "$DIST_DIR/$APP_NAME-linux-x64" \
  --compress Brotli

echo "[3b/5] Building Linux arm64 binary..."
npx pkg dist/sea-entry.cjs \
  --targets node22-linux-arm64 \
  --output "$DIST_DIR/$APP_NAME-linux-arm64" \
  --compress Brotli

# Step 5: Build macOS binaries
echo "[4/5] Building macOS x64 binary..."
npx pkg dist/sea-entry.cjs \
  --targets node22-macos-x64 \
  --output "$DIST_DIR/$APP_NAME-darwin-x64" \
  --compress Brotli

echo "[4b/5] Building macOS arm64 binary..."
npx pkg dist/sea-entry.cjs \
  --targets node22-macos-arm64 \
  --output "$DIST_DIR/$APP_NAME-darwin-arm64" \
  --compress Brotli

# Step 6: Create .deb package (uses linux-x64 binary)
echo "[5/5] Creating .deb package..."
DEB_DIR="$DIST_DIR/deb-build/${APP_NAME}_${VERSION}-1_amd64"
mkdir -p "$DEB_DIR/DEBIAN"
mkdir -p "$DEB_DIR/usr/bin"
mkdir -p "$DEB_DIR/usr/share/doc/$APP_NAME"

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

cp "$DIST_DIR/$APP_NAME-linux-x64" "$DEB_DIR/usr/bin/$APP_NAME"
chmod 755 "$DEB_DIR/usr/bin/$APP_NAME"
cp -f "$ROOT_DIR/LICENSE" "$DEB_DIR/usr/share/doc/$APP_NAME/" 2>/dev/null || true
dpkg-deb --build "$DEB_DIR" "$DIST_DIR/${APP_NAME}_${VERSION}-1_amd64.deb"
rm -rf "$DIST_DIR/deb-build"

# Summary
echo ""
echo "=== Build Complete ==="
echo ""
echo "Output in: $DIST_DIR/"
echo ""
ls -lh "$DIST_DIR/"
echo ""

for f in "$DIST_DIR"/*; do
  name="$(basename "$f")"
  case "$name" in
    $APP_NAME-win-x64.exe)    echo "✅ Windows x64:   $name ($(du -h "$f" | cut -f1))" ;;
    $APP_NAME-linux-x64)      echo "✅ Linux x64:     $name ($(du -h "$f" | cut -f1))" ;;
    $APP_NAME-linux-arm64)    echo "✅ Linux arm64:   $name ($(du -h "$f" | cut -f1))" ;;
    $APP_NAME-darwin-x64)     echo "✅ macOS x64:     $name ($(du -h "$f" | cut -f1))" ;;
    $APP_NAME-darwin-arm64)   echo "✅ macOS arm64:   $name ($(du -h "$f" | cut -f1))" ;;
    *.deb)                    echo "✅ .deb package:  $name ($(du -h "$f" | cut -f1))" ;;
  esac
done
