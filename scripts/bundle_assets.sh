#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/dist/assets"
rm -rf "$OUT"
mkdir -p "$OUT"

bundle_dir () {
  local name="$1"
  local src="$2"
  local dst="$OUT/$name"
  mkdir -p "$dst"
  # Copy only extension runtime files (no repo docs)
  rsync -a --delete     --exclude ".git"     --exclude "dist"     "$src/" "$dst/"
}

bundle_dir "chromium" "$ROOT/packages/chromium"
bundle_dir "edge" "$ROOT/packages/edge"
bundle_dir "firefox" "$ROOT/packages/firefox"

# Create zips of folder-shaped assets for release (optional)
cd "$OUT"
zip -r -q "../assets-chromium.zip" "chromium"
zip -r -q "../assets-edge.zip" "edge"
zip -r -q "../assets-firefox.zip" "firefox"

echo "Created assets bundles in $OUT and zipped to dist/assets-*.zip"
