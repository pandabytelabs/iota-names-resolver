#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: scripts/bump_version.sh <version>"
  exit 1
fi

VERSION="$1"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

MANIFESTS=(
  "$ROOT/packages/chromium/manifest.json"
  "$ROOT/packages/edge/manifest.json"
  "$ROOT/packages/firefox/manifest.json"
)

update_with_sed () {
  local file="$1"
  sed -i.bak -E '0,/"version"[[:space:]]*:[[:space:]]*"[^"]*"/s//"version": "'"$VERSION"'"/' "$file"
  rm -f "${file}.bak"
}

if command -v jq >/dev/null 2>&1; then
  for f in "${MANIFESTS[@]}"; do
    tmp="$(mktemp)"
    jq --arg v "$VERSION" '.version = $v' "$f" > "$tmp"
    mv "$tmp" "$f"
  done
else
  for f in "${MANIFESTS[@]}"; do
    update_with_sed "$f"
  done
fi

echo "Updated versions to $VERSION"
