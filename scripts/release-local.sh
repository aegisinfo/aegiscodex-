#!/usr/bin/env bash
# Local release — mirrors what the GitHub "Build & Release" workflow does on a tag push
#
# Usage:
#   ./scripts/release-local.sh          # read version from package.json
#   ./scripts/release-local.sh 4.21     # explicit version
#
# Steps:
#   1.  Bump version in package.json (if --version given)
#   2.  Create annotated git tag v<version>
#   3.  Build (npm run build:publish)
#   4.  Publish to npm (npm publish)
#   5.  Push tag to origin (so GitHub Actions finishes the release)
#
# Requires: npm login (NPM_TOKEN in ~/.npmrc), git push access
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  VERSION=$(node -p "require('./package.json').version")
  echo "→ Using current version from package.json: $VERSION"
else
  # Strip leading v if provided
  VERSION="${VERSION#v}"
  node -e "const p=require('./package.json'); p.version='$VERSION'; require('fs').writeFileSync('package.json', JSON.stringify(p, null, 2)+'\n')"
  echo "→ Bumped package.json version to $VERSION"
  git add package.json
  git commit -m "chore: bump version to v${VERSION}" || echo "  (nothing to commit)"
fi

TAG="v${VERSION}"

# ── Check prerequisites ────────────────────────────────────────────────────
if ! git diff --cached --quiet 2>/dev/null; then
  echo "⚠ You have staged but uncommitted changes. Commit or stash them first."
  exit 1
fi

echo ""
echo "═══ aegiscodex-  release v${VERSION} ═══"

# ── Tag ────────────────────────────────────────────────────────────────────
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "→ Tag $TAG already exists locally."
else
  git tag -a "$TAG" -m "Release ${TAG}"
  echo "→ Created tag $TAG"
fi

# ── Build ──────────────────────────────────────────────────────────────────
echo "→ Building..."
npm run build:publish

# ── Publish to npm ─────────────────────────────────────────────────────────
echo "→ Publishing to npm..."
npm publish --access public

# ── Push tag ───────────────────────────────────────────────────────────────
echo "→ Pushing tag $TAG to origin..."
git push origin "$TAG"

echo ""
echo "═══ Done — release v${VERSION} published to npm ═══"
echo "  Tag:     $TAG (pushed to origin)"
echo "  npm:     https://www.npmjs.com/package/aegiscode/v/${VERSION}"
echo ""
echo "GitHub Actions will now pick up the tag and create the GitHub Release."
