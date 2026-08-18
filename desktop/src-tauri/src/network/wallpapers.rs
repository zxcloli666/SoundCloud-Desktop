//! Online wallpaper search across several engines (Wallhaven / Pinterest /
//! Konachan / Safebooru). Lives in Rust because Wallhaven and Konachan reject
//! a non-browser `User-Agent` with 403, and the webview's plugin-http cannot
//! reliably set that forbidden header. Here reqwest has full control. The
//! frontend gets a compact, already-normalized list — response shapes are never
//! trusted blindly, every field is guarded.
//!
//! Pagination is unified behind an opaque `cursor`: page-based engines encode
//! the next page number, Pinterest carries its bookmark token; `None` = done.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

/// Browser User-Agent. Wallhaven and Konachan 403 anything else; the proxy's
/// `direct` mode reuses this for image fetches too.
pub const BROWSER_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const WALLPAPER_CONNECT_TIMEOUT_MS: u64 = 8_000;
const WALLPAPER_REQUEST_TIMEOUT_MS: u64 = 12_000;
const BOORU_LIMIT: usize = 24;
const PINTEREST_PAGE: u32 = 25;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WallpaperQuery {
    pub source: String,
    #[serde(default)]
    pub query: String,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub cursor: Option<String>,
    #[serde(default)]
    pub adult: bool,
    #[serde(default)]
    pub api_key: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct WallpaperHit {
    pub id: String,
    pub thumb: String,
    pub full: String,
    pub resolution: String,
}

#[derive(Debug, Serialize)]
pub struct WallpaperSearchResult {
    pub items: Vec<WallpaperHit>,
    pub cursor: Option<String>,
}

#[tauri::command]
pub async fn wallpaper_search(args: WallpaperQuery) -> Result<WallpaperSearchResult, String> {
    match args.source.as_str() {
        "pinterest" => search_pinterest(&args).await,
        "konachan" => search_konachan(&args).await,
        "safebooru" => search_safebooru(&args).await,
        _ => search_wallhaven(&args).await,
    }
}

fn wallpaper_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_millis(WALLPAPER_CONNECT_TIMEOUT_MS))
        .timeout(Duration::from_millis(WALLPAPER_REQUEST_TIMEOUT_MS))
        .user_agent(BROWSER_UA)
        .build()
        .map_err(|error| format!("wallpaper client: {error}"))
}

// ── shared helpers ──────────────────────────────────────────

async fn send_json(req: reqwest::RequestBuilder) -> Result<Value, String> {
    let resp = req
        .header("User-Agent", BROWSER_UA)
        .header("Accept", "application/json")
        .timeout(Duration::from_millis(WALLPAPER_REQUEST_TIMEOUT_MS))
        .send()
        .await
        .map_err(|e| format!("request: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("http {}", resp.status().as_u16()));
    }
    let body = resp.text().await.map_err(|e| format!("body: {e}"))?;
    serde_json::from_str(&body).map_err(|e| format!("json: {e}"))
}

/// String field, or "" when missing / not a string.
fn s(v: &Value, key: &str) -> String {
    v.get(key).and_then(Value::as_str).unwrap_or("").to_string()
}

fn first_nonempty(opts: &[String]) -> String {
    opts.iter().find(|s| !s.is_empty()).cloned().unwrap_or_default()
}

fn id_of(v: &Value, fallback: &str) -> String {
    match v.get("id") {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Number(n)) => n.to_string(),
        _ => fallback.to_string(),
    }
}

fn dims(v: &Value) -> String {
    let w = v.get("width").and_then(Value::as_u64).unwrap_or(0);
    let h = v.get("height").and_then(Value::as_u64).unwrap_or(0);
    if w > 0 && h > 0 {
        format!("{w}x{h}")
    } else {
        String::new()
    }
}

fn page_from_cursor(c: &Option<String>) -> u32 {
    c.as_deref()
        .and_then(|s| s.parse::<u32>().ok())
        .filter(|n| *n >= 1)
        .unwrap_or(1)
}

fn next_booru_cursor(count: usize, page: u32) -> Option<String> {
    if count >= BOORU_LIMIT {
        Some((page + 1).to_string())
    } else {
        None
    }
}

fn tags_from_query(query: &str) -> Vec<String> {
    query.split_whitespace().map(|t| t.to_string()).collect()
}

// ── Wallhaven ───────────────────────────────────────────────

async fn search_wallhaven(a: &WallpaperQuery) -> Result<WallpaperSearchResult, String> {
    let page = page_from_cursor(&a.cursor);
    let cat = match a.category.as_deref() {
        Some("general") => "100",
        Some("people") => "001",
        _ => "010", // anime default
    };
    let key = a
        .api_key
        .as_deref()
        .map(str::trim)
        .filter(|k| !k.is_empty());
    let purity = if a.adult && key.is_some() { "111" } else { "100" };
    let q = a.query.trim();
    let color = a
        .color
        .as_deref()
        .map(|c| c.trim_start_matches('#'))
        .filter(|c| !c.is_empty());
    let sorting = if !q.is_empty() || color.is_some() {
        "relevance"
    } else {
        "toplist"
    };

    let mut params: Vec<(&str, String)> = vec![
        ("categories", cat.to_string()),
        ("purity", purity.to_string()),
        ("atleast", "1920x1080".to_string()),
        ("sorting", sorting.to_string()),
        ("page", page.to_string()),
    ];
    if !q.is_empty() {
        params.push(("q", q.to_string()));
    }
    if let Some(k) = key {
        params.push(("apikey", k.to_string()));
    }
    if let Some(c) = color {
        params.push(("colors", c.to_string()));
    }

    let client = wallpaper_client()?;
    let json = send_json(
        client
            .get("https://wallhaven.cc/api/v1/search")
            .query(&params),
    )
        .await?;

    let mut items = Vec::new();
    if let Some(data) = json.get("data").and_then(Value::as_array) {
        for d in data {
            let full = s(d, "path");
            if full.is_empty() {
                continue;
            }
            let thumb = match d.get("thumbs") {
                Some(t) => first_nonempty(&[s(t, "small"), s(t, "large"), full.clone()]),
                None => full.clone(),
            };
            items.push(WallpaperHit {
                id: id_of(d, &full),
                thumb,
                full,
                resolution: s(d, "resolution"),
            });
        }
    }

    let last = json
        .get("meta")
        .and_then(|m| m.get("last_page"))
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let cursor = if (page as u64) < last {
        Some((page + 1).to_string())
    } else {
        None
    };
    Ok(WallpaperSearchResult { items, cursor })
}

// ── Konachan (Moebooru) ─────────────────────────────────────

async fn search_konachan(a: &WallpaperQuery) -> Result<WallpaperSearchResult, String> {
    let page = page_from_cursor(&a.cursor);
    let mut tags = tags_from_query(&a.query);
    if !a.adult {
        tags.push("rating:safe".to_string());
    }
    if tags.is_empty() || (tags.len() == 1 && tags[0] == "rating:safe") {
        tags.push("order:score".to_string());
    }

    let client = wallpaper_client()?;
    let json = send_json(client.get("https://konachan.com/post.json").query(&[
        ("limit", BOORU_LIMIT.to_string()),
        ("page", page.to_string()),
        ("tags", tags.join(" ")),
    ]))
        .await?;

    let mut items = Vec::new();
    if let Some(arr) = json.as_array() {
        for d in arr {
            let full = first_nonempty(&[s(d, "file_url"), s(d, "jpeg_url"), s(d, "sample_url")]);
            if full.is_empty() {
                continue;
            }
            let thumb = first_nonempty(&[s(d, "preview_url"), s(d, "sample_url"), full.clone()]);
            items.push(WallpaperHit {
                id: id_of(d, &full),
                thumb,
                resolution: dims(d),
                full,
            });
        }
    }
    let cursor = next_booru_cursor(items.len(), page);
    Ok(WallpaperSearchResult { items, cursor })
}

// ── Safebooru (Gelbooru 0.2) ────────────────────────────────

async fn search_safebooru(a: &WallpaperQuery) -> Result<WallpaperSearchResult, String> {
    let page = page_from_cursor(&a.cursor);
    let mut tags = tags_from_query(&a.query);
    if tags.is_empty() {
        tags.push("sort:score:desc".to_string());
    }

    let client = wallpaper_client()?;
    let json = send_json(client.get("https://safebooru.org/index.php").query(&[
        ("page", "dapi".to_string()),
        ("s", "post".to_string()),
        ("q", "index".to_string()),
        ("json", "1".to_string()),
        ("limit", BOORU_LIMIT.to_string()),
        ("pid", (page - 1).to_string()),
        ("tags", tags.join(" ")),
    ]))
        .await?;

    // Bare array of posts, or {post:[…]} / {} when empty.
    let empty: Vec<Value> = Vec::new();
    let arr = json
        .as_array()
        .or_else(|| json.get("post").and_then(Value::as_array))
        .unwrap_or(&empty);

    let mut items = Vec::new();
    for d in arr {
        let full = first_nonempty(&[s(d, "file_url"), s(d, "sample_url")]);
        if full.is_empty() {
            continue;
        }
        let thumb = first_nonempty(&[s(d, "preview_url"), s(d, "sample_url"), full.clone()]);
        items.push(WallpaperHit {
            id: id_of(d, &full),
            thumb,
            resolution: dims(d),
            full,
        });
    }
    let cursor = next_booru_cursor(items.len(), page);
    Ok(WallpaperSearchResult { items, cursor })
}

// ── Pinterest (undocumented BaseSearchResource) ─────────────

async fn search_pinterest(a: &WallpaperQuery) -> Result<WallpaperSearchResult, String> {
    let q = a.query.trim();
    let query = if q.is_empty() { "wallpaper" } else { q };
    let mut options = serde_json::json!({ "query": query, "scope": "pins", "page_size": PINTEREST_PAGE });
    if let Some(bm) = a.cursor.as_deref().filter(|c| !c.is_empty()) {
        options["bookmarks"] = serde_json::json!([bm]);
    }
    let data = serde_json::json!({ "options": options, "context": {} }).to_string();
    let source = format!("/search/pins/?q={query}");

    let client = wallpaper_client()?;
    let json = send_json(
        client
            .get("https://www.pinterest.com/resource/BaseSearchResource/get/")
            .query(&[("source_url", source), ("data", data)])
            .header("x-pinterest-pws-handler", "www/search/[scope].js"),
    )
        .await?;

    let rr = json.get("resource_response");
    let data = rr.and_then(|r| r.get("data"));
    // Pinterest serves two shapes: `data` as a flat array, or an object with a
    // `results` array (richer format with ad/guide modules). Handle both.
    let results = data
        .and_then(Value::as_array)
        .or_else(|| data.and_then(|d| d.get("results")).and_then(Value::as_array));

    let mut items = Vec::new();
    if let Some(arr) = results {
        for r in arr {
            let imgs = r.get("images");
            let orig = imgs.and_then(|i| i.get("orig"));
            let full = orig.map(|o| s(o, "url")).unwrap_or_default();
            if full.is_empty() {
                continue;
            }
            let t474 = imgs
                .and_then(|i| i.get("474x"))
                .map(|o| s(o, "url"))
                .unwrap_or_default();
            let t236 = imgs
                .and_then(|i| i.get("236x"))
                .map(|o| s(o, "url"))
                .unwrap_or_default();
            let thumb = first_nonempty(&[t474, t236, full.clone()]);
            let resolution = orig.map(dims).unwrap_or_default();
            items.push(WallpaperHit {
                id: id_of(r, &full),
                thumb,
                full,
                resolution,
            });
        }
    }

    let bm = rr.map(|r| s(r, "bookmark")).unwrap_or_default();
    let cursor = if !items.is_empty() && !bm.is_empty() && bm != "-end-" {
        Some(bm)
    } else {
        None
    };
    Ok(WallpaperSearchResult { items, cursor })
}

// ── live network smoke tests ────────────────────────────────
// These hit the real endpoints, so they're #[ignore]d (kept out of normal
// `cargo test` / CI). Run on demand with:
//   cargo test --lib network::wallpapers -- --ignored --nocapture --test-threads=1

#[cfg(test)]
mod tests {
    use super::*;

    fn query(source: &str, q: &str) -> WallpaperQuery {
        WallpaperQuery {
            source: source.to_string(),
            query: q.to_string(),
            category: None,
            color: None,
            cursor: None,
            adult: false,
            api_key: None,
        }
    }

    fn assert_hits(label: &str, r: &WallpaperSearchResult) {
        println!("{label}: {} items, cursor={}", r.items.len(), r.cursor.is_some());
        assert!(!r.items.is_empty(), "{label} returned no items");
        let first = &r.items[0];
        println!("  first full={} thumb={}", first.full, first.thumb);
        assert!(!first.full.is_empty(), "{label} hit has empty full url");
        assert!(!first.thumb.is_empty(), "{label} hit has empty thumb url");
    }

    #[tokio::test]
    #[ignore = "live network"]
    async fn smoke_wallhaven() {
        assert_hits("WALLHAVEN", &search_wallhaven(&query("wallhaven", "")).await.unwrap());
    }

    #[tokio::test]
    #[ignore = "live network"]
    async fn smoke_konachan() {
        assert_hits("KONACHAN", &search_konachan(&query("konachan", "")).await.unwrap());
    }

    #[tokio::test]
    #[ignore = "live network"]
    async fn smoke_safebooru() {
        assert_hits("SAFEBOORU", &search_safebooru(&query("safebooru", "")).await.unwrap());
    }

    #[tokio::test]
    #[ignore = "live network"]
    async fn smoke_pinterest() {
        // Regression: Pinterest serves `data` as an object-with-`results`, not a
        // flat array — must still extract hits.
        assert_hits(
            "PINTEREST",
            &search_pinterest(&query("pinterest", "anime wallpaper")).await.unwrap(),
        );
    }
}
