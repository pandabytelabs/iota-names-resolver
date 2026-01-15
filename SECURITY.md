# Security Policy

If you discover a security vulnerability, please open a GitHub Security Advisory or contact the maintainers privately.
Avoid disclosing issues publicly until a fix is released.

## Threat model notes
- This extension makes JSON-RPC calls to a user-configurable endpoint.
- It does not inject scripts into arbitrary pages beyond detecting navigations to *.iota.
- Review permissions and host patterns before every release.
