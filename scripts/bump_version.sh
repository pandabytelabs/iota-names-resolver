#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: scripts/bump_version.sh <version>"
  echo "Example: scripts/bump_version.sh 0.2.1"
  exit 1
fi

VERSION="$1"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

MANIFESTS=(
  "$ROOT/packages/chromium/manifest.json"
  "$ROOT/packages/edge/manifest.json"
  "$ROOT/packages/firefox/manifest.json"
)

update_with_jq () {
  local file="$1"
  tmp="$(mktemp)"
  jq --arg v "$VERSION" '.version = $v' "$file" > "$tmp"
  mv "$tmp" "$file"
}

update_with_sed () {
  local file="$1"
  # Replace the first occurrence of: "version": "..."
  # Works for the manifests in this repo (standard JSON formatting).
  sed -i.bak -E '0,/"version"[[:space:]]*:[[:space:]]*"[^"]*"/s//"version": "'"$VERSION"'"/' "$file"
  rm -f "${file}.bak"
}

if command -v jq >/dev/null 2>&1; then
  for f in "${MANIFESTS[@]}"; do
    update_with_jq "$f"
  done
else
  echo "jq not found; using sed-based replacement."
  for f in "${MANIFESTS[@]}"; do
    update_with_sed "$f"
  done
fi

echo "Updated manifest versions to $VERSION:"
for f in "${MANIFESTS[@]}"; do
  echo " - $f"
done
