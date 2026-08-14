# Backend configuration

`backend.config.json` is the single source of service addresses for both the
React frontend and the Rust/Tauri core.

Fields:

- `apiBase` — authentication, catalog and user API.
- `streamingBase` — playback endpoints.
- `imagesBase` — image proxy upstream.
- `storageBase` — stored media fallback.
- `healthBase` — optional topology endpoint. Set to `null` for a backend without
  the original health protocol.
- `relayZone` — optional relay DNS zone. Set to `null` when the backend has no
  compatible relay network.

All production bases must use HTTPS. Local `http://localhost` and
`http://127.0.0.1` bases are accepted only in debug Rust builds.

Tauri's HTTP allowlist is intentionally static. When a base host changes, add
its exact HTTPS origin to `src-tauri/capabilities/default.json`; otherwise the
frontend request will be rejected before it reaches the network. This explicit
second step prevents a compromised config response from granting itself access
to arbitrary hosts.
