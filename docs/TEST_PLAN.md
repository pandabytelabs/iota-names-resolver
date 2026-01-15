# Test plan (release)

## Functional
1. Enter `https://example.iota/` -> resolves and redirects or shows details.
2. In Brave address bar: `iota example.iota` (omnibox) -> works.
3. Popup: resolve name, confirm it navigates to `https://<name>/` and then redirects/details.
4. Change RPC URL in popup/options, reload extension, verify it persists.
5. Dark mode: dropdown text legible in Options and Popup.

## Cross-browser
- Chromium/Brave: MV3 service worker runs.
- Edge: same as Chromium.
- Firefox: background script runs; verify storage.session fallback works.

## Security/Privacy
- Confirm no analytics endpoints.
- Confirm only configured RPC endpoint is contacted.
