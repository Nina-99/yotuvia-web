#!/usr/bin/env bash
#
# Build and deploy the Yotuvia web SPA on the VPS.
#
# Run from a checkout that has yotuvia-core as a SIBLING directory, exactly like
# the monorepo:  ./yotuvia-web and ./yotuvia-core
#
#   cd yotuvia-web && ./deploy/deploy-web.sh
#
# Overridable:
#   CORE_DIR    path to the core checkout   (default ../yotuvia-core)
#   TARGET_DIR  nginx root for the SPA      (default /srv/yotuvia/web)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORE_DIR="${CORE_DIR:-$REPO_DIR/../yotuvia-core}"
TARGET_DIR="${TARGET_DIR:-/srv/yotuvia/web}"

if [ ! -d "$CORE_DIR" ]; then
  echo "ERROR: yotuvia-core not found at $CORE_DIR." >&2
  echo "       Check out both repos as siblings or set CORE_DIR." >&2
  exit 1
fi

if [ ! -f "$REPO_DIR/.env.production" ] && [ -f "$REPO_DIR/.env.local" ]; then
  echo "WARNING: no .env.production found." >&2
  echo "         Vite also loads .env.local in a production build, so the" >&2
  echo "         Google/Facebook client ids from your dev machine get baked in." >&2
  echo "         Create .env.production with the production VITE_* values." >&2
fi

echo "==> Building yotuvia-core"
cd "$CORE_DIR"
bun install --frozen-lockfile
bun run build

echo "==> Building yotuvia-web"
cd "$REPO_DIR"
bun install --frozen-lockfile
bun run build

if [ ! -f "$REPO_DIR/dist/index.html" ]; then
  echo "ERROR: build produced no dist/index.html. Refusing to sync." >&2
  exit 1
fi

echo "==> Publishing dist/ to $TARGET_DIR"
mkdir -p "$TARGET_DIR"
# --delete removes assets from previous builds; hashed filenames mean nothing
# stale is ever reused, so keeping the old files would only waste space.
rsync -a --delete "$REPO_DIR/dist/" "$TARGET_DIR/"

echo "==> Deploy OK"
echo "    index.html: $TARGET_DIR/index.html"
