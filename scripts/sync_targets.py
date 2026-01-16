#!/usr/bin/env python3
"""Sync Edge and Firefox targets from Chromium target.
- Edge: copy Chromium folder -> packages/edge
- Firefox: copy Chromium folder -> packages/firefox, then apply manifest/background differences

Usage: python3 scripts/sync_targets.py
"""
import json, shutil, pathlib

root = pathlib.Path(__file__).resolve().parents[1]
src = root / "packages" / "chromium"
edge = root / "packages" / "edge"
ff = root / "packages" / "firefox"

def copytree_clean(a, b):
    if b.exists():
        shutil.rmtree(b)
    shutil.copytree(a, b)

copytree_clean(src, edge)
# Edge manifest tweak
m = json.loads((edge / "manifest.json").read_text(encoding="utf-8"))
m["minimum_edge_version"] = m.get("minimum_edge_version", "110.0")
(edge / "manifest.json").write_text(json.dumps(m, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

copytree_clean(src, ff)

# Firefox adjustments
sw = ff / "service_worker.js"
bg = ff / "background.js"
if sw.exists():
    sw.rename(bg)

mf_path = ff / "manifest.json"
mf = json.loads(mf_path.read_text(encoding="utf-8"))

# Firefox supports MV3 host_permissions. Keep host_permissions and remove any Chromium-only
# permission strings that Firefox rejects.

bg_obj = mf.get("background", {})
bg_obj.pop("type", None)
bg_obj.pop("service_worker", None)
bg_obj["scripts"] = ["background.js"]
mf["background"] = bg_obj

perms = set(mf.get("permissions", []))

# Firefox does not accept "omnibox" as a permission string (the omnibox feature is declared
# via the "omnibox" manifest key). Host match patterns must live in host_permissions.
perms.discard("omnibox")
mf["permissions"] = sorted(perms)

mf["browser_specific_settings"] = mf.get("browser_specific_settings", {
    "gecko": {
        "id": "iota-names-resolver@example.com",
        "strict_min_version": "109.0"
    }
})
mf_path.write_text(json.dumps(mf, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

print("Synced targets.")
