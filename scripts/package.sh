#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"
mkdir -p "$DIST"

zip_dir () {
  local src="$1"
  local out="$2"
  (cd "$src" && zip -r -q "$out" .)
}

zip_dir "$ROOT/packages/chromium" "$DIST/iota-names-resolver-chromium.zip"
zip_dir "$ROOT/packages/edge" "$DIST/iota-names-resolver-edge.zip"

# Firefox: .xpi is a zip container with manifest at root
zip_dir "$ROOT/packages/firefox" "$DIST/iota-names-resolver-firefox.xpi"

# Checksums
( cd "$DIST" && sha256sum * > SHA256SUMS.txt )

echo "Artifacts:"
ls -la "$DIST"
