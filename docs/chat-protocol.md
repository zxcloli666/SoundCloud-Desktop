# Chat protocol notes

## Storage

Local chat data is a plain SQLite file. User-written fields are sealed per row, search runs over keyed token hashes. Picked by spike 0.D on 2026-10-20 (fallback B, SQLCipher failed, see below).

### Crates

| Crate | Version | Features |
|---|---|---|
| `rusqlite` | `=0.40.2` | `bundled` (libsqlite3-sys 0.38.2, SQLite 3.53.2, FTS5 built in) |
| `chacha20poly1305` | `=0.10.1` | default (`alloc`, `getrandom`) |
| `hmac` | `=0.12.1` | default |
| `sha2` | `0.10` (0.10.9 locked) | default |

All crypto is pure Rust. BoringSSL from wreq (`btls-sys` 0.5.6) stays the only libcrypto in the binary.

### Linux link flag

The desktop exe on Linux links with `-Wl,--exclude-libs,ALL`. In `desktop/src-tauri/build.rs`:

```rust
if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("linux") {
    println!("cargo:rustc-link-arg-bins=-Wl,--exclude-libs,ALL");
}
```

Without it the exe exports the static SQLite, and system libraries bind to it at load time instead of their own libsqlite3:

| Build | `sqlite3_*` exported | Bound into the exe at load |
|---|---|---|
| Ubuntu 22.04 amd64 | 52 | webkit2gtk 47, libsoup 5 |
| Ubuntu 22.04 arm64 | 268 | webkit2gtk 47, libsoup 5, libsqlite3 3 |
| Flatpak, GNOME 49 | not read (stripped) | libsqlite3 51, webkit2gtk 47, tinysparql 35, libsoup 5 |
| any of them with the flag | 0 | 0 |

libsqlite3 sending its own calls into another SQLite copy mixes two engines on one handle. Measured with `LD_BIND_NOW=1 LD_DEBUG=bindings`. macOS (two-level namespace) and Windows (per-DLL imports) are not affected.

### Layout

- Key: 32 bytes from the keychain (`KeyStore`). Subkeys: `HMAC-SHA256(key, "chat-store body")` for bodies, `HMAC-SHA256(key, "chat-store fts")` for search.
- Body: XChaCha20-Poly1305, random 24-byte nonce per row, aad `conv_id || seq` (seq as big-endian i64). Columns `nonce BLOB, body BLOB`. A row copied to another `(conv, seq)` does not open.
- Search: FTS5 table with `content='', contentless_delete=1, tokenize='ascii'`, rowid = message rowid. Each word is lowercased and its prefixes of 2..16 chars are indexed as `hex(HMAC-SHA256(fts_key, prefix)[..12])`. The query is the token of the typed prefix (first 16 chars), so "прив" finds "Привет". `DELETE ... WHERE rowid = ?` drops the entry.
- Token hashes show which messages share a word, nothing else. Ids, seq, class and timestamps stay plain for queries.
- Purge (`gone`, room end, delete for me, expiry): a plain `DELETE` leaves the sealed body and its tokens in free pages and in the WAL. Every connection sets `PRAGMA secure_delete = ON`, so bodies are scrubbed at once, and every purge ends with `PRAGMA wal_checkpoint(TRUNCATE)`. Tokens leave only with `INSERT INTO search(search) VALUES('optimize')`: `gone`, room end and delete for me run it after a batch that removed rows, expiry marks it owed (meta key `search_owed`) and runs it at most once per 60 s. Checked on 3.53.2: with all three no byte of the purged row is left in the db or WAL file. Without `secure_delete` the body and tokens stay in the db, without `optimize` the tokens stay, without the checkpoint the WAL keeps the body.
- Delete for me: `(conv, seq)` stays in `hidden_messages` (schema v2), so a history page, a reset or a reconcile never writes the row or its edits, reactions and pins back.

### Why not SQLCipher

`rusqlite` with `bundled-sqlcipher-vendored-openssl` (SQLCipher 4.14.0, OpenSSL 3.6.3 from openssl-src 300.6.1) adds a second libcrypto and libssl next to BoringSSL. 1784 libcrypto names exist in both (macOS arm64 build), 17 of them are SQLCipher imports (`EVP_*`, `PKCS5_PBKDF2_HMAC`, `RAND_bytes`, `OpenSSL_version`).

| Target | Result |
|---|---|
| Linux amd64 (rust-lld) | link fails, `duplicate symbol` |
| Linux arm64 (GNU ld) | link fails, 1091 `multiple definition` |
| Windows x64 (link.exe) | link fails, 1086 `LNK2005`, `LNK1169` |
| macOS arm64, x86_64 (ld) | links with 1069 / 1074 duplicate symbol warnings, then SIGSEGV on the first keyed write: OpenSSL `HMAC_Init_ex` gets a BoringSSL `EVP_MD` |

wreq `prefix-symbols` renames BoringSSL only on Linux and Android, so it does not help macOS or Windows. Standalone (no BoringSSL) SQLCipher works, which is why this only shows up in the real binary.

### Checked targets

Every desktop row is the real Tauri binary started with `--store-probe`: write, FTS search, delete, reopen, then a wreq request in the same process (TLS 1.3, HTTP/2), then reopen and check again.

| Target | Build | Result |
|---|---|---|
| Windows x64 | `pnpm tauri build` | ok, no VC++ runtime imports |
| macOS arm64 | `pnpm tauri build --target aarch64-apple-darwin` | ok |
| macOS x86_64 | cross from arm64, run under Rosetta | ok |
| Linux amd64, arm64 | `pnpm tauri build` (.deb) | ok |
| Flatpak | GNOME 49 manifest | ok |
| AUR `soundcloud-bin` | .deb unpacked like the PKGBUILD on Arch | ok |
| Arch source build | `cargo build --release` with makepkg.conf flags | ok |
| Android | cargo-ndk 4.1.2, API 24, arm64-v8a, armeabi-v7a, x86_64, x86 | cdylib links, needs only libc, libm, libdl, exports no sqlite3 or crypto symbol |
| iOS | xcframework, ios-arm64 and arm64 + x86_64 simulator | store test passes in the simulator |

CI runs (spike branch deleted after):
- SQLCipher and the unflagged Linux exports: https://github.com/zxcloli666/SoundCloud-Desktop/actions/runs/39439666287
- final config on every target: https://github.com/zxcloli666/SoundCloud-Desktop/actions/runs/39442572938
- AUR bin on the final deb: https://github.com/zxcloli666/SoundCloud-Desktop/actions/runs/39443995204
