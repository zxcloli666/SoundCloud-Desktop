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
- `sendBehavioralData` — opt-in for passive listening history and recommendation
  feedback (`full_play`, `skip`, wave/cluster outcomes). Keep it `false` for a
  backend you do not control. Explicit account actions such as likes, comments
  and playlist edits are not affected.

All production bases must use HTTPS. Local `http://localhost` and
`http://127.0.0.1` bases are accepted only in debug Rust builds.

Tauri's HTTP allowlist is intentionally static. When a base host changes, add
its exact HTTPS origin to `src-tauri/capabilities/default.json`; otherwise the
frontend request will be rejected before it reaches the network. This explicit
second step prevents a compromised config response from granting itself access
to arbitrary hosts.

## SoundCloud data and playback

The backend does not need to mirror the complete SoundCloud catalog or proxy
every audio byte:

1. `apiBase` returns SoundCloud-shaped metadata for search, tracks, users and
   playlists. It may cache that metadata in PostgreSQL.
2. `streamingBase /download/:urn` resolves a track URN into progressive or HLS
   candidates. The desktop downloads the selected media URL directly from the
   SoundCloud CDN and starts playback from a small buffer.
3. The Rust core also has an anonymous direct SoundCloud API fallback and keeps
   the received audio in the local cache.
4. `storageBase` is an optional stored-media fallback for unavailable or
   already-cached tracks.

For a self-hosted deployment, replace all bases above, add the new HTTPS origins
to the Tauri allowlist, configure a separate SoundCloud OAuth application and
clear the old local session so users authenticate against the new backend.
