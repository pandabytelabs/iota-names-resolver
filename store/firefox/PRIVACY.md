# Privacy / Data usage

This extension resolves *.iota names by calling a user-configurable IOTA JSON-RPC endpoint.
It does not collect, store, or sell personal data. The only network requests are the JSON-RPC calls
initiated by the user’s navigation or explicit resolve action. Settings are stored locally via browser storage.

Data stored:
- RPC URL, network preset, UI preferences (auto-redirect, etc.)

Data sent:
- The entered hostname (e.g. example.iota) in the JSON-RPC request payload to the configured RPC endpoint.
