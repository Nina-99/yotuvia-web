#!/usr/bin/env bash
#
# Deploy the Yotuvia web SPA on the VPS.
#
# Two modes:
#   ARTIFACT_URL   download the release asset built by CI (recommended)
#   (none)         build from a checkout with yotuvia-core as its sibling
#
#   ./deploy/deploy-web.sh
#   ARTIFACT_URL=https://github.com/Nina-99/yotuvia-web/releases/download/v1.0.0/yotuvia-web-dist.tar.gz \
#     ./deploy/deploy-web.sh
#
# Overridable:
#   CORE_DIR    path to the core checkout   (default ../yotuvia-core)
#   TARGET_DIR  nginx root for the SPA      (default /srv/yotuvia/web)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORE_DIR="${CORE_DIR:-$REPO_DIR/../yotuvia-core}"
TARGET_DIR="${TARGET_DIR:-/srv/yotuvia/web}"
ARTIFACT_URL="${ARTIFACT_URL:-}"
ARTIFACT_FILE="${ARTIFACT_FILE:-}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

DIST_DIR="$WORK/dist"
mkdir -p "$DIST_DIR"

if [ -n "$ARTIFACT_URL" ]; then
  ASSET="$(basename "$ARTIFACT_URL")"
  echo "==> Downloading $ASSET"
  curl -fsSL -o "$WORK/$ASSET" "$ARTIFACT_URL"

  if curl -fsSL -o "$WORK/$ASSET.sha256" "$ARTIFACT_URL.sha256" 2>/dev/null; then
    echo "==> Verifying checksum"
    (cd "$WORK" && sha256sum -c "$ASSET.sha256")
  else
    echo "WARNING: no $ASSET.sha256 published next to the artifact; skipping checksum." >&2
  fi

  tar -xzf "$WORK/$ASSET" -C "$DIST_DIR"

elif [ -n "$ARTIFACT_FILE" ]; then
  if [ ! -f "$ARTIFACT_FILE" ]; then
    echo "ERROR: artifact not found: $ARTIFACT_FILE" >&2
    exit 1
  fi
  echo "==> Extracting $ARTIFACT_FILE"
  tar -xzf "$ARTIFACT_FILE" -C "$DIST_DIR"

else
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
  ( cd "$CORE_DIR" && bun install --frozen-lockfile && bun run build )

  echo "==> Building yotuvia-web"
  ( cd "$REPO_DIR" && bun install --frozen-lockfile && bun run build )

  rm -rf "$DIST_DIR"
  cp -a "$REPO_DIR/dist" "$DIST_DIR"
fi

if [ ! -f "$DIST_DIR/index.html" ]; then
  echo "ERROR: no index.html in the artifact/build. Refusing to publish." >&2
  exit 1
fi

echo "==> Publishing to $TARGET_DIR"
mkdir -p "$TARGET_DIR"
# --delete removes assets from previous builds; hashed filenames mean nothing
# stale is ever reused, so keeping the old files would only waste space.
rsync -a --delete "$DIST_DIR/" "$TARGET_DIR/"

echo "==> Deploy OK"
echo "    index.html: $TARGET_DIR/index.html"
