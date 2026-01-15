# Safari (macOS) packaging

Safari does not load a raw WebExtension folder directly for distribution.
Typical workflow:

1. Use Apple’s Safari Web Extension converter to generate an Xcode project from the Chromium target:
   - Input: `packages/chromium/`
   - Output: Xcode project that wraps the extension as a macOS app.

2. In Xcode:
   - Configure bundle identifier, signing, entitlements.
   - Build and run for local testing.
   - Archive for distribution (Mac App Store) or sign/notarize for outside-store distribution.

Notes:
- Keep the extension code in `packages/chromium/` as the source of truth.
- Re-run the converter when the extension changes, or set up a script to re-sync resources.
