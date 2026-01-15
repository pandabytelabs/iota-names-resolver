#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"
mkdir -p "$DIST"

zip -r "$DIST/iota-names-resolver-chromium.zip" "$ROOT/packages/chromium" >/dev/null
zip -r "$DIST/iota-names-resolver-edge.zip" "$ROOT/packages/edge" >/dev/null
# Firefox: AMO accepts .xpi; it is a zip container
cd "$ROOT/packages/firefox"
zip -r "$DIST/iota-names-resolver-firefox.xpi" . >/dev/null
echo "Created:"
ls -la "$DIST"

# Deprecated: use package.sh
