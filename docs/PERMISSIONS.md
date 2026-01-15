# Permissions rationale

## tabs
Used to update the current tab URL when a *.iota name resolves to a website, and to open the details page.

## storage
Stores user settings (RPC URL, network preset, redirect behavior, cache TTL, etc.).

## webNavigation
Detects top-level navigations to hosts ending in `.iota` so the extension can resolve the name and redirect/show details.

## omnibox
Provides a reliable user flow in browsers that may treat `name.iota` as a search query in the address bar.

## Host patterns
`*://*.iota/*` is used to detect navigations to `.iota` hosts. No other host access is required.
