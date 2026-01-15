# IOTA Names Resolver (.iota)

Release-ready multi-browser repository.

## Targets
- Chromium / Chrome / Brave: `packages/chromium/`
- Microsoft Edge: `packages/edge/`
- Firefox (AMO): `packages/firefox/`
- Safari (macOS): see `safari/README.md` (Safari Web Extension via Xcode)

## Build artifacts
```bash
python3 scripts/sync_targets.py   # optional: regenerate edge/firefox from chromium
bash scripts/package.sh
```

Artifacts in `dist/`:
- `iota-names-resolver-chromium.zip`
- `iota-names-resolver-edge.zip`
- `iota-names-resolver-firefox.xpi`
- `SHA256SUMS.txt`

## Release
```bash
./scripts/bump_version.sh 0.2.1
git commit -am "Release 0.2.1"
git tag v0.2.1
git push --follow-tags
```

## License
MIT © 2026 PANDABYTE
