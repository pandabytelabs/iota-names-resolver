#!/usr/bin/env python3
"""Bump version across all target manifests.
Usage: python3 scripts/bump_version.py 0.2.1
"""
import json, sys, pathlib

if len(sys.argv) != 2:
    print("Usage: bump_version.py <version>")
    sys.exit(1)

version = sys.argv[1].strip()
root = pathlib.Path(__file__).resolve().parents[1]
targets = [
    root / "packages" / "chromium" / "manifest.json",
    root / "packages" / "edge" / "manifest.json",
    root / "packages" / "firefox" / "manifest.json",
]
for p in targets:
    data = json.loads(p.read_text(encoding="utf-8"))
    data["version"] = version
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("Updated:", ", ".join(str(p) for p in targets))
