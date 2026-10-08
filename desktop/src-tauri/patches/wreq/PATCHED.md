# wreq 5.3.0, patched

A copy of wreq 5.3.0 from crates.io, used through `[patch.crates-io]` in `desktop/src-tauri/Cargo.toml`.

Changes against the crates.io release:
- `src/connect.rs`, `ConnectorBuilder::new`: added `http.set_nodelay(nodelay);`. wreq 5.3.0 never passes `ClientBuilder::tcp_nodelay` to its `HttpConnector`, so every socket kept Nagle on. That costs one extra round trip on each new connection: the client holds the h2 preface and the first request until the server ACKs its TLS Finished. reqwest sets the same flag in the same place.
- `Cargo.toml`: examples, tests and dev-dependencies removed (their files are not copied); `dead_code` allowed, as cargo does for a registry crate.

`src/network/nodelay_tests.rs` (Linux) reads `TCP_NODELAY` on a live client socket and fails without the patch.

Drop this copy when the app moves to a wreq release that applies `tcp_nodelay` to the connector: check `ConnectorBuilder::new` and run `nodelay_tests` against it. Every wreq 5.x release is yanked; moving to 6.x needs `sc-fingerprint` (SoundCloud-Backend) to move first.
