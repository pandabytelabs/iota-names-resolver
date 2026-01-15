# Store submission (essentials)

This file is intentionally short. It covers only the recurring items maintainers typically need.

## Build
```bash
bash scripts/package.sh
```

## What to upload
- Chrome Web Store: `dist/iota-names-resolver-chromium.zip`
- Edge Add-ons: `dist/iota-names-resolver-edge.zip`
- Firefox AMO: `dist/iota-names-resolver-firefox.xpi`

## Before submitting
- Replace `assets/store/screenshot_*.png` placeholders with real screenshots.
- Review `docs/PERMISSIONS.md` and ensure permissions match current behavior.
- Ensure `store/*/PRIVACY.md` matches the current network behavior and settings.
