use std::collections::{HashMap, HashSet};
use std::error::Error as _;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::Mutex as StdMutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use futures_util::StreamExt;
use reqwest::{Client, Url};
use tauri::Emitter;
use tokio::fs::File;
use tokio::io::{AsyncWriteExt, BufWriter};
use tokio::sync::{Mutex, Notify, OwnedSemaphorePermit, Semaphore};

use crate::app::diagnostics::log_native;
use crate::track_cache::direct_download::{try_download, Candidate};
use crate::track_cache::sc_anon::AnonClient;
use crate::track_cache::transcode;

const MIN_AUDIO_SIZE: u64 = 8192;
const AUDIO_SNIFF_LEN: usize = 16;
const PROGRESS_EMIT_STEP: f64 = 0.01;
const STREAM_WRITE_BUFFER_SIZE: usize = 256 * 1024;
const STORAGE_CONNECT_TIMEOUT_MS: u64 = 800;
const STORAGE_TIMEOUT_MS: u64 = 1200;
const STORAGE_COOLDOWN_SECS: u64 = 60;
const DOWNLOAD_CONNECT_TIMEOUT_MS: u64 = 3_000;
const DOWNLOAD_READ_TIMEOUT_SECS: u64 = 130;
const DIRECT_CONNECT_TIMEOUT_MS: u64 = 5_000;
const DIRECT_READ_TIMEOUT_SECS: u64 = 70;
const TRACK_CACHE_CHUNK_TIMEOUT_MS: u64 = 12_000;
const TRACK_CACHE_TEXT_TIMEOUT_MS: u64 = 10_000;
const TRACK_CACHE_COVER_TIMEOUT_MS: u64 = 8_000;
const RETRY_DELAYS_MS: [u64; 3] = [200, 600, 1500];
// Preloading resolves and warms only a tiny stream prefix. Keep one speculative
// request in flight so it cannot compete with foreground playback.
const MAX_PARALLEL_PRELOADS: usize = 1;
const STREAM_PRELOAD_TTL: Duration = Duration::from_secs(45);
const MAX_STREAM_PRELOADS: usize = 8;
const MAX_PARALLEL_LIKES: usize = 4;
/// Transcoding is CPU-bound; keep it modest so it never starves playback on weak
/// machines. Most cached tracks are already AAC (a near-free remux), so a small
/// pool drains the queue fast in practice.
const MAX_PARALLEL_TRANSCODES: usize = 2;
const CACHE_METADATA_EXT: &str = ".meta.json";
/// Cover art fetched for download-to-file export is capped to avoid pathological
/// payloads sneaking into the muxer.
const MAX_COVER_BYTES: u64 = 8 * 1024 * 1024;
/// Duration drift allowed between a cached file and the API-reported length
/// before the cache entry is treated as a truncated (interrupted) download.
const DURATION_TOLERANCE_MS: u64 = 4000;
const DURATION_TOLERANCE_FRAC: f64 = 0.04;
/// How many times a track may transcode "too short" before we accept that the
/// source only offers a preview and stop re-fetching it (prevents a download loop
/// for tracks whose API length is full but whose only stream is a 30s snippet).
const MAX_TRUNCATED_RETRIES: u8 = 2;
/// Grace before deleting the raw А file after its clean Б is committed. A path
/// handed to the player is read in a separate command a few ms later; this keeps
/// that file alive across the gap so playback never reads a just-deleted file.
const INCOMING_GRACE_SECS: u64 = 30;

/// Magic-byte validation for audio files
fn is_valid_audio(prefix: &[u8], total_size: u64) -> bool {
    if total_size < MIN_AUDIO_SIZE {
        return false;
    }
    // ID3 (MP3)
    if prefix.len() >= 3 && prefix[0] == 0x49 && prefix[1] == 0x44 && prefix[2] == 0x33 {
        return true;
    }
    // MPEG Sync (MP3 / ADTS AAC)
    if prefix.len() >= 2 && prefix[0] == 0xff && (prefix[1] & 0xe0) == 0xe0 {
        return true;
    }
    // ftyp (MP4/AAC)
    if prefix.len() >= 8
        && prefix[4] == 0x66
        && prefix[5] == 0x74
        && prefix[6] == 0x79
        && prefix[7] == 0x70
    {
        return true;
    }
    // OggS
    if prefix.len() >= 4
        && prefix[0] == 0x4f
        && prefix[1] == 0x67
        && prefix[2] == 0x67
        && prefix[3] == 0x53
    {
        return true;
    }
    // RIFF/WAV
    if prefix.len() >= 4
        && prefix[0] == 0x52
        && prefix[1] == 0x49
        && prefix[2] == 0x46
        && prefix[3] == 0x46
    {
        return true;
    }
    // fLaC
    if prefix.len() >= 4
        && prefix[0] == 0x66
        && prefix[1] == 0x4c
        && prefix[2] == 0x61
        && prefix[3] == 0x43
    {
        return true;
    }
    false
}

fn urn_to_filename(urn: &str) -> String {
    format!("{}.audio", urn.replace(':', "_"))
}

fn filename_to_urn(filename: &str) -> Option<String> {
    let stripped = filename.strip_suffix(".audio")?;
    Some(stripped.replace('_', ":"))
}

fn is_audio_cache_file(path: &Path) -> bool {
    path.extension().and_then(|ext| ext.to_str()) == Some("audio")
}

fn is_valid_file(path: &Path) -> bool {
    std::fs::metadata(path)
        .map(|m| m.len() >= MIN_AUDIO_SIZE)
        .unwrap_or(false)
}

/// Whether a cached file's length is acceptable against the API-reported length.
/// Deliberately one-sided: only a file *shorter* than expected signals a
/// truncated/interrupted download. A *longer* file means the API length was an
/// underestimate — most importantly a Go+ 30s preview length for a track whose
/// full audio we actually cached — so it is kept. A symmetric check would flag
/// those as corrupt and re-download them forever.
fn cached_duration_ok(actual: u64, expected: u64) -> bool {
    let tol = DURATION_TOLERANCE_MS.max((expected as f64 * DURATION_TOLERANCE_FRAC) as u64);
    actual + tol >= expected
}

/// A clean file is trustworthy unless its probed length is recorded and falls
/// short of the recorded API length (a truncated download committed pre-crash).
fn meta_duration_ok(meta: Option<&TrackCacheMetadata>) -> bool {
    match meta.and_then(|m| m.duration_ms.zip(m.expected_duration_ms)) {
        Some((actual, expected)) => cached_duration_ok(actual, expected),
        None => true,
    }
}

fn cache_metadata_path(path: &Path) -> PathBuf {
    PathBuf::from(format!("{}{}", path.display(), CACHE_METADATA_EXT))
}

fn remove_cache_metadata(path: &Path) {
    std::fs::remove_file(cache_metadata_path(path)).ok();
}

fn truncate_error_text(text: &str, max_chars: usize) -> String {
    let truncated: String = text.chars().take(max_chars).collect();
    if text.chars().count() > max_chars {
        format!("{}...", truncated.trim_end())
    } else {
        truncated
    }
}

fn extract_json_error(value: &serde_json::Value) -> Option<String> {
    if let Some(message) = value.get("message").and_then(|v| v.as_str()) {
        return Some(message.to_string());
    }
    if let Some(error) = value.get("error").and_then(|v| v.as_str()) {
        return Some(error.to_string());
    }
    if let Some(errors) = value.get("errors").and_then(|v| v.as_array()) {
        let parts = errors
            .iter()
            .filter_map(|entry| {
                entry
                    .get("error_message")
                    .and_then(|v| v.as_str())
                    .or_else(|| entry.get("message").and_then(|v| v.as_str()))
                    .or_else(|| entry.get("error").and_then(|v| v.as_str()))
                    .map(str::to_string)
            })
            .collect::<Vec<_>>();
        if !parts.is_empty() {
            return Some(parts.join("; "));
        }
    }
    None
}

fn normalize_error_body(body: &str) -> Option<String> {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return None;
    }

    let compact = if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
        extract_json_error(&value).unwrap_or_else(|| value.to_string())
    } else {
        trimmed.to_string()
    };

    let single_line = compact.split_whitespace().collect::<Vec<_>>().join(" ");
    if single_line.is_empty() {
        None
    } else {
        Some(truncate_error_text(&single_line, 220))
    }
}

fn format_reqwest_error(err: reqwest::Error) -> String {
    let mut details = Vec::new();
    if err.is_timeout() {
        details.push("timeout".to_string());
    } else if err.is_connect() {
        details.push("connect".to_string());
    } else if err.is_redirect() {
        details.push("redirect".to_string());
    } else if err.is_body() {
        details.push("body".to_string());
    } else if err.is_decode() {
        details.push("decode".to_string());
    } else if err.is_request() {
        details.push("request".to_string());
    }

    if let Some(status) = err.status() {
        details.push(format!("HTTP {status}"));
    }

    let mut causes = Vec::new();
    let mut source = err.source();
    while let Some(next) = source {
        let text = next.to_string();
        if !text.is_empty() && !causes.iter().any(|existing| existing == &text) {
            causes.push(text);
        }
        source = next.source();
    }

    let mut message = err.without_url().to_string();
    if !details.is_empty() {
        message.push_str(&format!(" [{}]", details.join(", ")));
    }
    if !causes.is_empty() {
        message.push_str(&format!(": {}", causes.join(": ")));
    }
    message
}

#[derive(Clone, Copy, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PlaybackQuality {
    Hq,
    Sq,
}

impl PlaybackQuality {
    pub(crate) fn label(self) -> &'static str {
        match self {
            Self::Hq => "hq",
            Self::Sq => "sq",
        }
    }
}

/// Tracks active downloads so duplicate requests coalesce.
struct ActiveDownload {
    notify: Arc<Notify>,
    cancel: Arc<Notify>,
    result: Arc<Mutex<Option<Result<PathBuf, String>>>>,
}

#[derive(Clone, Copy, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DownloadSource {
    Storage,
    Anon,
    Direct,
    Api,
}

impl DownloadSource {
    pub(crate) fn label(self) -> &'static str {
        match self {
            Self::Storage => "storage",
            Self::Anon => "anon",
            Self::Direct => "direct",
            Self::Api => "api",
        }
    }
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
struct TrackCacheMetadata {
    quality: PlaybackQuality,
    #[serde(default)]
    source: Option<DownloadSource>,
    /// Whether the transcoded output belongs in the protected `liked_dir`.
    /// Recorded on the raw incoming file so startup recovery routes it correctly.
    #[serde(default)]
    liked: bool,
    /// API-reported track length (ms), used to detect truncated downloads.
    #[serde(default)]
    expected_duration_ms: Option<u64>,
    /// Probed length (ms) of the committed clean file.
    #[serde(default)]
    duration_ms: Option<u64>,
}

#[derive(Clone, serde::Serialize)]
pub struct TrackCacheEntry {
    pub path: String,
    pub quality: Option<String>,
    pub source: Option<String>,
}

impl TrackCacheEntry {
    fn from_path_and_meta(path: &Path, meta: Option<TrackCacheMetadata>) -> Self {
        Self {
            path: path.to_string_lossy().into_owned(),
            quality: meta.as_ref().map(|m| m.quality.label().to_string()),
            source: meta.and_then(|m| m.source.map(|s| s.label().to_string())),
        }
    }
}

/// One row of the offline page's batched cache inventory: everything the UI
/// needs about a cached file in a single IPC round-trip.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheInventoryEntry {
    pub urn: String,
    pub bytes: u64,
    /// "clean" = transcoded m4a in Б, "raw" = staged in А awaiting transcode.
    pub stage: &'static str,
    pub liked: bool,
    pub quality: Option<String>,
    pub source: Option<String>,
    /// Probed length (ms) of the committed clean file; absent for raw/legacy files.
    pub duration_ms: Option<u64>,
    pub expected_duration_ms: Option<u64>,
    /// Last modification, epoch seconds.
    pub modified_at: Option<u64>,
}

/// Live snapshot of the А→Б transcode pipeline for the Settings UI.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscodeStatus {
    /// "ready" | "preparing" | "unavailable".
    pub ffmpeg: &'static str,
    /// Raw files staged in А.
    pub incoming: u32,
    pub incoming_bytes: u64,
    /// Transcodes in flight right now.
    pub transcoding: u32,
    /// URNs being forged right now, for per-row UI state.
    pub transcoding_urns: Vec<String>,
    /// Clean m4a files in Б (audio + liked).
    pub clean: u32,
    pub clean_bytes: u64,
}

enum DownloadError {
    Fatal(String),
    Retryable(String),
}

struct DownloadResult {
    path: PathBuf,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LikeCacheEntry {
    pub urn: String,
    pub urls: Vec<String>,
    #[serde(default)]
    pub download_urls: Vec<String>,
    #[serde(default)]
    pub storage_urls: Vec<String>,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub hq: bool,
    #[serde(default)]
    pub duration_ms: Option<u64>,
}

pub struct CacheRequest<'a> {
    pub urn: &'a str,
    pub urls: &'a [String],
    pub download_urls: &'a [String],
    pub storage_urls: &'a [String],
    pub session_id: Option<&'a str>,
    pub hq: bool,
    pub liked: bool,
    /// API-reported track length (ms), if known — enables truncated-download
    /// detection. `None` falls back to the size + magic-byte gate only.
    pub expected_duration_ms: Option<u64>,
}

struct FallbackParams<'a> {
    target_dir: &'a Path,
    urn: &'a str,
    urls: &'a [String],
    download_urls: &'a [String],
    storage_urls: &'a [String],
    session_id: Option<&'a str>,
    hq: bool,
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn host_of(url: &str) -> Option<String> {
    Url::parse(url).ok()?.host_str().map(str::to_string)
}

/// Convert a storage stream URL (`<base>/<file>.m4a`) into a redirect URL
/// (`<base>/redirect/<file>.m4a`) that 307s to a backend-direct download
/// (presigned S3 URL or public Drive link, depending on storage backend).
fn make_redirect_url(storage_url: &str) -> Option<String> {
    let mut parsed = Url::parse(storage_url).ok()?;
    let path = parsed.path().trim_start_matches('/').to_string();
    if path.is_empty() || path.starts_with("redirect/") {
        return None;
    }
    parsed.set_path(&format!("redirect/{path}"));
    Some(parsed.to_string())
}

/// Count and total bytes of cached audio files in a dir.
fn dir_stats(dir: &Path) -> (u32, u64) {
    let mut count = 0u32;
    let mut total = 0u64;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata()
                && meta.is_file() && is_audio_cache_file(&entry.path()) {
                    count += 1;
                    total += meta.len();
                }
        }
    }
    (count, total)
}

fn dir_size(dir: &Path) -> u64 {
    dir_stats(dir).1
}

fn clear_audio_dir(dir: &Path) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if entry.metadata().map(|m| m.is_file()).unwrap_or(false) && is_audio_cache_file(&path)
            {
                std::fs::remove_file(&path).ok();
                remove_cache_metadata(&path);
            }
        }
    }
}

fn collect_cached_urns(
    dir: &Path,
    seen: &mut std::collections::HashSet<String>,
    out: &mut Vec<String>,
) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        let Some(urn) = filename_to_urn(&name) else {
            continue;
        };
        let meta = entry.metadata();
        if meta.map(|m| m.len() >= MIN_AUDIO_SIZE).unwrap_or(false) {
            if seen.insert(urn.clone()) {
                out.push(urn);
            }
        } else {
            let path = entry.path();
            std::fs::remove_file(&path).ok();
            remove_cache_metadata(&path);
        }
    }
}

/// Remove abandoned temp files from interrupted writes/transcodes: `.part`
/// (audio/transcode renders) and `.meta.json.tmp` (metadata renders). Only call
/// when no writer is active (startup, before the webview issues downloads).
fn sweep_temp_files(dir: &Path) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.contains(".part") || name.ends_with(".tmp") {
            std::fs::remove_file(entry.path()).ok();
        }
    }
}

/// Valid raw URNs awaiting transcode; drops undersized stragglers in passing.
fn list_incoming_urns(dir: &Path) -> Vec<String> {
    let mut out = Vec::new();
    let Ok(entries) = std::fs::read_dir(dir) else {
        return out;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !is_audio_cache_file(&path) {
            continue;
        }
        let Some(urn) = filename_to_urn(&entry.file_name().to_string_lossy()) else {
            continue;
        };
        if is_valid_file(&path) {
            out.push(urn);
        } else {
            std::fs::remove_file(&path).ok();
            remove_cache_metadata(&path);
        }
    }
    out
}

#[derive(Clone)]
pub struct TrackCacheState {
    pub audio_dir: PathBuf,
    pub liked_dir: PathBuf,
    /// Staging area (folder "А") for freshly downloaded raw bytes awaiting
    /// transcode into the clean m4a caches (`audio_dir` / `liked_dir` = folder "Б").
    pub incoming_dir: PathBuf,
    pub client: Client,
    pub storage_client: Client,
    pub direct_client: Client,
    pub app_handle: Option<crate::rt::AppHandle>,
    /// Managed ffmpeg binary, populated asynchronously at startup (system PATH
    /// or download). Shared so the background acquire is visible to all clones.
    /// `None` disables transcoding (cache then serves raw bytes from `incoming_dir`).
    ffmpeg: Arc<StdMutex<Option<PathBuf>>>,
    /// Set once the startup ffmpeg acquisition finishes (success or not), so the
    /// UI can distinguish "still preparing" from "gave up / unavailable".
    ffmpeg_probe_done: Arc<std::sync::atomic::AtomicBool>,
    active: Arc<Mutex<HashMap<String, ActiveDownload>>>,
    preload_limiter: Arc<Semaphore>,
    preloaded_streams: Arc<StdMutex<HashMap<String, (Instant, Vec<Candidate>)>>>,
    likes_limiter: Arc<Semaphore>,
    transcode_limiter: Arc<Semaphore>,
    /// URNs with a transcode in flight, so live + recovery requests coalesce.
    transcoding: Arc<StdMutex<HashSet<String>>>,
    /// Per-URN count of consecutive "transcoded too short" results, to cap
    /// re-downloads of preview-only tracks (best-effort, per session).
    truncated_retries: Arc<StdMutex<HashMap<String, u8>>>,
    likes_running: Arc<std::sync::atomic::AtomicBool>,
    likes_cancel: Arc<std::sync::atomic::AtomicBool>,
    /// Per-host storage circuit breaker: host -> epoch secs of last failure.
    storage_cooldowns: Arc<StdMutex<HashMap<String, u64>>>,
    anon: Arc<AnonClient>,
}

pub fn init(audio_dir: PathBuf, liked_dir: PathBuf, incoming_dir: PathBuf) -> TrackCacheState {
    // Sweep temps left by an interrupted previous run. Safe here: init() runs
    // during setup, before the webview can issue any download, so nothing the
    // sweep matches is live.
    for dir in [&incoming_dir, &audio_dir, &liked_dir] {
        sweep_temp_files(dir);
    }

    let client = Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .tcp_nodelay(true)
        .pool_max_idle_per_host(16)
        .connect_timeout(Duration::from_millis(DOWNLOAD_CONNECT_TIMEOUT_MS))
        .read_timeout(Duration::from_secs(DOWNLOAD_READ_TIMEOUT_SECS))
        .build()
        .expect("failed to build reqwest client");

    let storage_client = Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .tcp_nodelay(true)
        .pool_max_idle_per_host(4)
        .connect_timeout(Duration::from_millis(STORAGE_CONNECT_TIMEOUT_MS))
        .timeout(Duration::from_millis(STORAGE_TIMEOUT_MS))
        .build()
        .expect("failed to build storage client");

    let direct_client = Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .tcp_nodelay(true)
        .pool_max_idle_per_host(16)
        .connect_timeout(Duration::from_millis(DIRECT_CONNECT_TIMEOUT_MS))
        .read_timeout(Duration::from_secs(DIRECT_READ_TIMEOUT_SECS))
        .build()
        .expect("failed to build direct client");

    let anon_client = Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .tcp_nodelay(true)
        .pool_max_idle_per_host(16)
        .connect_timeout(Duration::from_millis(DOWNLOAD_CONNECT_TIMEOUT_MS))
        .read_timeout(Duration::from_secs(DOWNLOAD_READ_TIMEOUT_SECS))
        .build()
        .expect("failed to build anon client");
    let anon = Arc::new(AnonClient::new(anon_client));

    TrackCacheState {
        audio_dir,
        liked_dir,
        incoming_dir,
        client,
        storage_client,
        direct_client,
        app_handle: None,
        ffmpeg: Arc::new(StdMutex::new(None)),
        ffmpeg_probe_done: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        active: Arc::new(Mutex::new(HashMap::new())),
        preload_limiter: Arc::new(Semaphore::new(MAX_PARALLEL_PRELOADS)),
        preloaded_streams: Arc::new(StdMutex::new(HashMap::new())),
        likes_limiter: Arc::new(Semaphore::new(MAX_PARALLEL_LIKES)),
        transcode_limiter: Arc::new(Semaphore::new(MAX_PARALLEL_TRANSCODES)),
        transcoding: Arc::new(StdMutex::new(HashSet::new())),
        truncated_retries: Arc::new(StdMutex::new(HashMap::new())),
        likes_running: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        likes_cancel: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        storage_cooldowns: Arc::new(StdMutex::new(HashMap::new())),
        anon,
    }
}

fn quality_from_url(url: &str) -> PlaybackQuality {
    if Url::parse(url)
        .ok()
        .map(|parsed| {
            parsed
                .query_pairs()
                .any(|(key, value)| key == "hq" && value == "true")
        })
        .unwrap_or(false)
    {
        PlaybackQuality::Hq
    } else {
        PlaybackQuality::Sq
    }
}

fn temp_file_path(target_dir: &Path, urn: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    target_dir.join(format!("{}.{}.part", urn_to_filename(urn), nonce))
}

async fn cleanup_temp_file(path: &Path) {
    tokio::fs::remove_file(path).await.ok();
}

fn read_cache_metadata(path: &Path) -> Option<TrackCacheMetadata> {
    let raw = std::fs::read_to_string(cache_metadata_path(path)).ok()?;
    serde_json::from_str(&raw).ok()
}

async fn write_cache_metadata(path: &Path, meta: &TrackCacheMetadata) {
    let raw = match serde_json::to_vec(meta) {
        Ok(raw) => raw,
        Err(_) => return,
    };

    let final_path = cache_metadata_path(path);
    let temp_path = PathBuf::from(format!("{}.tmp", final_path.display()));
    if tokio::fs::write(&temp_path, raw).await.is_err() {
        tokio::fs::remove_file(&temp_path).await.ok();
        return;
    }

    if tokio::fs::rename(&temp_path, &final_path).await.is_err() {
        tokio::fs::remove_file(&temp_path).await.ok();
    }
}

async fn write_response_to_cache(
    target_dir: &Path,
    urn: &str,
    response: reqwest::Response,
    quality: PlaybackQuality,
    source: DownloadSource,
    app_handle: Option<&crate::rt::AppHandle>,
) -> Result<DownloadResult, DownloadError> {
    let final_path = target_dir.join(urn_to_filename(urn));
    let temp_path = temp_file_path(target_dir, urn);
    let file = File::create(&temp_path)
        .await
        .map_err(|err| DownloadError::Fatal(format!("Cache create failed: {err}")))?;
    let mut writer = BufWriter::with_capacity(STREAM_WRITE_BUFFER_SIZE, file);
    let content_length = response.content_length().unwrap_or(0);
    let mut stream = response.bytes_stream();
    let mut total_size = 0u64;
    let mut sniff = Vec::with_capacity(AUDIO_SNIFF_LEN);
    let mut emitted_progress = -1.0f64;

    loop {
        let chunk = match tokio::time::timeout(
            Duration::from_millis(TRACK_CACHE_CHUNK_TIMEOUT_MS),
            stream.next(),
        )
        .await
        {
            Ok(Some(Ok(chunk))) => chunk,
            Ok(Some(Err(err))) => {
                cleanup_temp_file(&temp_path).await;
                return Err(DownloadError::Retryable(format!("body read: {err}")));
            }
            Ok(None) => break,
            Err(_) => {
                cleanup_temp_file(&temp_path).await;
                return Err(DownloadError::Retryable(format!(
                    "body read timed out after {TRACK_CACHE_CHUNK_TIMEOUT_MS}ms"
                )));
            }
        };

        total_size += chunk.len() as u64;
        if sniff.len() < AUDIO_SNIFF_LEN {
            let copy_len = (AUDIO_SNIFF_LEN - sniff.len()).min(chunk.len());
            sniff.extend_from_slice(&chunk[..copy_len]);
        }

        if let Err(err) = writer.write_all(&chunk).await {
            cleanup_temp_file(&temp_path).await;
            return Err(DownloadError::Fatal(format!("Cache write failed: {err}")));
        }

        if let Some(app) = app_handle
            && content_length > 0 {
                let progress = total_size as f64 / content_length as f64;
                if progress - emitted_progress >= PROGRESS_EMIT_STEP {
                    emitted_progress = progress;
                    let _ = app.emit(
                        "track:download-progress",
                        serde_json::json!({
                            "urn": urn,
                            "downloaded": total_size,
                            "total": content_length,
                            "progress": progress,
                            "source": source.label(),
                        }),
                    );
                }
            }
    }

    if let Some(app) = app_handle
        && content_length > 0
        && emitted_progress < 1.0
    {
        let _ = app.emit(
            "track:download-progress",
            serde_json::json!({
                "urn": urn,
                "downloaded": total_size,
                "total": content_length,
                "progress": (total_size as f64 / content_length as f64).min(1.0),
                "source": source.label(),
            }),
        );
    }

    if let Err(err) = writer.flush().await {
        cleanup_temp_file(&temp_path).await;
        return Err(DownloadError::Fatal(format!("Cache flush failed: {err}")));
    }
    drop(writer);

    if !is_valid_audio(&sniff, total_size) {
        cleanup_temp_file(&temp_path).await;
        return Err(DownloadError::Fatal("Invalid audio data".into()));
    }

    let cache_meta = TrackCacheMetadata {
        quality,
        source: Some(source),
        liked: false,
        expected_duration_ms: None,
        duration_ms: None,
    };

    if let Ok(meta) = tokio::fs::metadata(&final_path).await
        && meta.len() >= MIN_AUDIO_SIZE {
            cleanup_temp_file(&temp_path).await;
            return Ok(DownloadResult { path: final_path });
        }

    match tokio::fs::rename(&temp_path, &final_path).await {
        Ok(()) => {
            write_cache_metadata(&final_path, &cache_meta).await;
            Ok(DownloadResult { path: final_path })
        }
        Err(first_err) => {
            if tokio::fs::metadata(&final_path)
                .await
                .map(|meta| meta.len() >= MIN_AUDIO_SIZE)
                .unwrap_or(false)
            {
                cleanup_temp_file(&temp_path).await;
                return Ok(DownloadResult { path: final_path });
            }

            tokio::fs::remove_file(&final_path).await.ok();
            match tokio::fs::rename(&temp_path, &final_path).await {
                Ok(()) => {
                    write_cache_metadata(&final_path, &cache_meta).await;
                    Ok(DownloadResult { path: final_path })
                }
                Err(second_err) => {
                    cleanup_temp_file(&temp_path).await;
                    Err(DownloadError::Fatal(format!(
                        "Cache rename failed: {first_err}; {second_err}"
                    )))
                }
            }
        }
    }
}

/// Write a fully buffered audio payload (e.g. anon HLS download) to cache.
async fn write_bytes_to_cache(
    target_dir: &Path,
    urn: &str,
    data: &[u8],
    quality: PlaybackQuality,
    source: DownloadSource,
) -> Result<DownloadResult, DownloadError> {
    let total_size = data.len() as u64;
    let sniff_len = AUDIO_SNIFF_LEN.min(data.len());
    if !is_valid_audio(&data[..sniff_len], total_size) {
        return Err(DownloadError::Fatal("Invalid audio data".into()));
    }

    let final_path = target_dir.join(urn_to_filename(urn));
    let temp_path = temp_file_path(target_dir, urn);

    let file = File::create(&temp_path)
        .await
        .map_err(|err| DownloadError::Fatal(format!("Cache create failed: {err}")))?;
    let mut writer = BufWriter::with_capacity(STREAM_WRITE_BUFFER_SIZE, file);
    if let Err(err) = writer.write_all(data).await {
        cleanup_temp_file(&temp_path).await;
        return Err(DownloadError::Fatal(format!("Cache write failed: {err}")));
    }
    if let Err(err) = writer.flush().await {
        cleanup_temp_file(&temp_path).await;
        return Err(DownloadError::Fatal(format!("Cache flush failed: {err}")));
    }
    drop(writer);

    let cache_meta = TrackCacheMetadata {
        quality,
        source: Some(source),
        liked: false,
        expected_duration_ms: None,
        duration_ms: None,
    };

    if let Ok(meta) = tokio::fs::metadata(&final_path).await
        && meta.len() >= MIN_AUDIO_SIZE {
            cleanup_temp_file(&temp_path).await;
            return Ok(DownloadResult { path: final_path });
        }

    match tokio::fs::rename(&temp_path, &final_path).await {
        Ok(()) => {
            write_cache_metadata(&final_path, &cache_meta).await;
            Ok(DownloadResult { path: final_path })
        }
        Err(first_err) => {
            if tokio::fs::metadata(&final_path)
                .await
                .map(|meta| meta.len() >= MIN_AUDIO_SIZE)
                .unwrap_or(false)
            {
                cleanup_temp_file(&temp_path).await;
                return Ok(DownloadResult { path: final_path });
            }

            tokio::fs::remove_file(&final_path).await.ok();
            match tokio::fs::rename(&temp_path, &final_path).await {
                Ok(()) => {
                    write_cache_metadata(&final_path, &cache_meta).await;
                    Ok(DownloadResult { path: final_path })
                }
                Err(second_err) => {
                    cleanup_temp_file(&temp_path).await;
                    Err(DownloadError::Fatal(format!(
                        "Cache rename failed: {first_err}; {second_err}"
                    )))
                }
            }
        }
    }
}

/// Download a track from an API URL to cache.
async fn download_api(
    client: &Client,
    target_dir: &Path,
    urn: &str,
    url: &str,
    session_id: Option<&str>,
    app_handle: Option<&crate::rt::AppHandle>,
) -> Result<DownloadResult, DownloadError> {
    let (response, hop) = crate::network::audio_route::get(client, url, session_id)
        .await
        .map_err(|err| DownloadError::Retryable(format!("request: {err}")))?;
    let status = response.status();

    if status.is_success() {
        let quality = quality_from_url(url);
        let result = write_response_to_cache(
            target_dir,
            urn,
            response,
            quality,
            DownloadSource::Api,
            app_handle,
        )
        .await;
        if matches!(&result, Err(DownloadError::Retryable(_))) {
            hop.note(false);
        }
        return result;
    }

    let body = match tokio::time::timeout(
        Duration::from_millis(TRACK_CACHE_TEXT_TIMEOUT_MS),
        response.text(),
    )
    .await
    {
        Ok(Ok(body)) => normalize_error_body(&body),
        Ok(Err(err)) => Some(format!(
            "failed to read response body: {}",
            format_reqwest_error(err)
        )),
        Err(_) => Some("response body timed out".to_string()),
    };
    let message = if let Some(body) = body {
        format!("HTTP {}: {}", status, body)
    } else {
        format!("HTTP {}", status)
    };
    Err(DownloadError::Retryable(message))
}

impl TrackCacheState {
    pub fn try_acquire_preload_slot(&self) -> Option<OwnedSemaphorePermit> {
        self.preload_limiter.clone().try_acquire_owned().ok()
    }

    pub(crate) fn store_preloaded_candidates(&self, urn: String, candidates: Vec<Candidate>) {
        if candidates.is_empty() {
            return;
        }
        let Ok(mut preloaded) = self.preloaded_streams.lock() else {
            return;
        };
        preloaded.retain(|_, (created_at, _)| created_at.elapsed() <= STREAM_PRELOAD_TTL);
        if preloaded.len() >= MAX_STREAM_PRELOADS
            && let Some(oldest) = preloaded
                .iter()
                .min_by_key(|(_, (created_at, _))| *created_at)
                .map(|(urn, _)| urn.clone())
        {
            preloaded.remove(&oldest);
        }
        preloaded.insert(urn, (Instant::now(), candidates));
    }

    pub(crate) fn take_preloaded_candidates(&self, urn: &str) -> Option<Vec<Candidate>> {
        let mut preloaded = self.preloaded_streams.lock().ok()?;
        let (created_at, candidates) = preloaded.remove(urn)?;
        (created_at.elapsed() <= STREAM_PRELOAD_TTL).then_some(candidates)
    }

    /// Wire up the Tauri AppHandle so that anon/cache writes can persist
    /// diagnostics to `desktop.log`.
    pub fn set_app_handle(&mut self, handle: crate::rt::AppHandle) {
        self.anon.set_app_handle(handle.clone());
        self.app_handle = Some(handle);
    }

    fn diag(&self, level: &str, msg: String) {
        if let Some(app) = self.app_handle.as_ref() {
            log_native(app, level, &msg);
        }
    }

    /// Current ffmpeg path, or `None` while it is still being acquired / when
    /// acquisition failed (transcoding disabled, raw bytes served instead).
    fn ffmpeg(&self) -> Option<PathBuf> {
        self.ffmpeg.lock().ok().and_then(|g| g.clone())
    }

    /// Acquire ffmpeg (system PATH or download into `install_dir`) and publish it
    /// to all clones. Run once in the background at startup, before recovery.
    pub async fn init_ffmpeg(&self, install_dir: PathBuf) {
        match transcode::acquire_ffmpeg(&install_dir).await {
            Some(path) => {
                let line = format!("[TrackCache] ffmpeg ready: {}", path.display());
                println!("{line}");
                self.diag("INFO", line);
                if let Ok(mut slot) = self.ffmpeg.lock() {
                    *slot = Some(path);
                }
            }
            None => {
                let line =
                    "[TrackCache] ffmpeg unavailable — transcoding disabled, serving raw audio"
                        .to_string();
                eprintln!("{line}");
                self.diag("WARN", line);
            }
        }
        self.ffmpeg_probe_done
            .store(true, std::sync::atomic::Ordering::Relaxed);
    }

    /// Live snapshot of the А→Б pipeline for the Settings UI.
    pub fn transcode_status(&self) -> TranscodeStatus {
        let ffmpeg = if self.ffmpeg().is_some() {
            "ready"
        } else if self
            .ffmpeg_probe_done
            .load(std::sync::atomic::Ordering::Relaxed)
        {
            "unavailable"
        } else {
            "preparing"
        };
        let (incoming, incoming_bytes) = dir_stats(&self.incoming_dir);
        let (audio_count, audio_bytes) = dir_stats(&self.audio_dir);
        let (liked_count, liked_bytes) = dir_stats(&self.liked_dir);
        let transcoding_urns: Vec<String> = self
            .transcoding
            .lock()
            .map(|s| s.iter().cloned().collect())
            .unwrap_or_default();
        TranscodeStatus {
            ffmpeg,
            incoming,
            incoming_bytes,
            transcoding: transcoding_urns.len() as u32,
            transcoding_urns,
            clean: audio_count + liked_count,
            clean_bytes: audio_bytes + liked_bytes,
        }
    }

    fn file_path(&self, urn: &str) -> PathBuf {
        self.audio_dir.join(urn_to_filename(urn))
    }

    fn liked_file_path(&self, urn: &str) -> PathBuf {
        self.liked_dir.join(urn_to_filename(urn))
    }

    fn incoming_file_path(&self, urn: &str) -> PathBuf {
        self.incoming_dir.join(urn_to_filename(urn))
    }

    /// A clean transcoded file (folder "Б") lives in the liked or audio dir, not
    /// in the raw staging dir.
    fn is_clean_path(&self, path: &Path) -> bool {
        path.starts_with(&self.audio_dir) || path.starts_with(&self.liked_dir)
    }

    /// Resolve only a clean (transcoded m4a) cached path, liked dir first.
    fn resolve_clean_path(&self, urn: &str) -> Option<PathBuf> {
        let liked = self.liked_file_path(urn);
        if is_valid_file(&liked) {
            return Some(liked);
        }
        let audio = self.file_path(urn);
        if is_valid_file(&audio) {
            return Some(audio);
        }
        None
    }

    /// Resolve any usable cached path: clean files first (liked, then audio),
    /// falling back to the raw incoming file while a transcode is pending.
    fn resolve_path(&self, urn: &str) -> Option<PathBuf> {
        self.resolve_clean_path(urn).or_else(|| {
            let incoming = self.incoming_file_path(urn);
            is_valid_file(&incoming).then_some(incoming)
        })
    }

    pub fn is_cached(&self, urn: &str) -> bool {
        self.resolve_path(urn).is_some()
    }

    pub fn get_cache_path(&self, urn: &str) -> Option<String> {
        self.resolve_path(urn)
            .map(|p| p.to_string_lossy().into_owned())
    }

    pub fn get_cache_entry(&self, urn: &str) -> Option<TrackCacheEntry> {
        let path = self.resolve_path(urn)?;
        let meta = read_cache_metadata(&path);
        // A clean file whose recorded length disagrees with the API length was a
        // truncated download — drop it so the next request re-fetches.
        if self.is_clean_path(&path) && !meta_duration_ok(meta.as_ref()) {
            let line = format!("[TrackCache] dropping truncated cache for {urn}");
            eprintln!("{line}");
            self.diag("WARN", line);
            self.remove_cached(urn);
            return None;
        }
        Some(TrackCacheEntry::from_path_and_meta(&path, meta))
    }

    /// Download track, save to cache. Coalesces concurrent requests for the same URN.
    /// Tries each URL in order with retries, falling back to the next on failure.
    fn storage_host_available(&self, host: &str) -> bool {
        let Ok(map) = self.storage_cooldowns.lock() else {
            return true;
        };
        match map.get(host) {
            None => true,
            Some(failed_at) => now_secs().saturating_sub(*failed_at) >= STORAGE_COOLDOWN_SECS,
        }
    }

    fn mark_storage_host_failed(&self, host: &str) {
        if let Ok(mut map) = self.storage_cooldowns.lock() {
            map.insert(host.to_string(), now_secs());
        }
    }

    fn mark_storage_host_ok(&self, host: &str) {
        if let Ok(mut map) = self.storage_cooldowns.lock() {
            map.remove(host);
        }
    }

    pub async fn ensure_cached(&self, req: CacheRequest<'_>) -> Result<TrackCacheEntry, String> {
        let CacheRequest {
            urn,
            urls,
            download_urls,
            storage_urls,
            session_id,
            hq,
            liked,
            expected_duration_ms,
        } = req;

        if let Some(entry) = self.get_cache_entry(urn) {
            println!("[TrackCache] hit: {urn}");
            return Ok(entry);
        }

        // Fresh bytes always land in the raw staging dir ("А"); a background
        // transcode promotes them to the clean m4a cache ("Б") afterwards.
        let target_dir = &self.incoming_dir;

        // Coalesce concurrent requests for the same URN
        let mut active = self.active.lock().await;
        if let Some(existing) = active.get(urn) {
            println!("[TrackCache] coalescing request for {urn}");
            let notify = existing.notify.clone();
            let result_slot = existing.result.clone();
            drop(active);
            // `notify_waiters()` keeps no permit for late waiters, so register the
            // wait BEFORE re-checking the result slot. If the winner already
            // stored its result (and possibly fired the now-lost notification),
            // the re-check returns it; otherwise we are registered and will be
            // woken. This closes the lost-wakeup hang.
            let notified = notify.notified();
            tokio::pin!(notified);
            notified.as_mut().enable();
            let mut result = result_slot.lock().await.clone();
            if result.is_none() {
                notified.await;
                result = result_slot.lock().await.clone();
            }
            return match result {
                Some(Ok(path)) => {
                    // Re-resolve: the transcode may have already promoted А→Б and
                    // deleted the raw path stored in the slot.
                    let current = self.resolve_path(urn).unwrap_or(path);
                    Ok(TrackCacheEntry::from_path_and_meta(
                        &current,
                        read_cache_metadata(&current),
                    ))
                }
                Some(Err(e)) => Err(e),
                None => Err("download completed without result".into()),
            };
        }

        let notify = Arc::new(Notify::new());
        let cancel = Arc::new(Notify::new());
        let result_slot: Arc<Mutex<Option<Result<PathBuf, String>>>> = Arc::new(Mutex::new(None));
        active.insert(
            urn.to_string(),
            ActiveDownload {
                notify: notify.clone(),
                cancel: cancel.clone(),
                result: result_slot.clone(),
            },
        );
        drop(active);

        let (download_result, cancelled) = {
            let download = self.download_with_fallback(FallbackParams {
                target_dir,
                urn,
                urls,
                download_urls,
                storage_urls,
                session_id,
                hq,
            });
            tokio::pin!(download);
            tokio::select! {
                // Prefer a result that became ready at the same instant as a cancel.
                biased;
                result = &mut download => (result, false),
                _ = cancel.notified() => (Err("download cancelled".to_string()), true),
            }
        };
        // The cancelled future (and any open BufWriter it owned) is dropped at the
        // end of the block above, so Windows can now remove its staging file.
        if cancelled {
            cleanup_temp_file(&temp_file_path(target_dir, urn)).await;
        }

        // Stamp the raw file with routing + integrity info, then kick off the
        // background transcode (А → Б). Playback uses the raw path immediately.
        if let Ok(ref incoming_path) = download_result {
            self.finalize_incoming(incoming_path, liked, expected_duration_ms)
                .await;
            self.spawn_transcode(urn.to_string());
        }

        {
            let mut slot = result_slot.lock().await;
            *slot = Some(download_result.clone());
        }
        notify.notify_waiters();
        self.active.lock().await.remove(urn);

        download_result.map(|path| {
            // Hand back whatever currently exists (clean Б if the transcode is
            // already done, else the raw А path) so the caller never receives a
            // path the background transcode is about to delete.
            let current = self.resolve_path(urn).unwrap_or(path);
            TrackCacheEntry::from_path_and_meta(&current, read_cache_metadata(&current))
        })
    }

    /// Cancel an in-flight download that is no longer needed by the player.
    /// Coalesced callers are woken with the same cancellation result.
    pub async fn cancel_download(&self, urn: &str) -> bool {
        let active = self.active.lock().await;
        let Some(download) = active.get(urn) else {
            return false;
        };
        let notify = download.notify.clone();
        let result = download.result.clone();
        let finished = notify.notified();
        tokio::pin!(finished);
        finished.as_mut().enable();
        // `notify_one` retains a permit if the owner has not entered select yet,
        // which closes the start-vs-cancel race.
        download.cancel.notify_one();
        drop(active);
        if result.lock().await.is_none() {
            finished.await;
        }
        true
    }

    /// Commit bytes collected by the fast-start player into the normal raw cache
    /// and hand them to the existing transcode pipeline. Playback owns a separate
    /// in-memory buffer, so this write cannot invalidate the live decoder.
    pub(crate) async fn store_streamed_bytes(
        &self,
        urn: &str,
        data: &[u8],
        quality: PlaybackQuality,
        source: DownloadSource,
        expected_duration_ms: Option<u64>,
    ) -> Result<TrackCacheEntry, String> {
        if let Some(entry) = self.get_cache_entry(urn) {
            return Ok(entry);
        }

        let result = write_bytes_to_cache(&self.incoming_dir, urn, data, quality, source)
            .await
            .map_err(|error| match error {
                DownloadError::Fatal(message) | DownloadError::Retryable(message) => message,
            })?;
        self.finalize_incoming(&result.path, false, expected_duration_ms)
            .await;
        self.spawn_transcode(urn.to_string());

        let current = self.resolve_path(urn).unwrap_or(result.path);
        Ok(TrackCacheEntry::from_path_and_meta(
            &current,
            read_cache_metadata(&current),
        ))
    }

    /// Record the destination (liked vs normal) and API duration on the raw
    /// incoming file so the transcode/recovery steps can route and validate it.
    async fn finalize_incoming(
        &self,
        incoming_path: &Path,
        liked: bool,
        expected_duration_ms: Option<u64>,
    ) {
        // Only stamp files that actually live in the staging dir; if a
        // coalesced winner already produced a clean file, leave it be.
        if !incoming_path.starts_with(&self.incoming_dir) {
            return;
        }
        let mut meta = read_cache_metadata(incoming_path).unwrap_or(TrackCacheMetadata {
            quality: PlaybackQuality::Sq,
            source: None,
            liked,
            expected_duration_ms,
            duration_ms: None,
        });
        meta.liked = liked;
        if expected_duration_ms.is_some() {
            meta.expected_duration_ms = expected_duration_ms;
        }
        write_cache_metadata(incoming_path, &meta).await;
    }

    /// Queue a background transcode of a raw incoming file into the clean cache.
    /// No-op when ffmpeg is unavailable or a transcode for this URN is already
    /// in flight (live request and startup recovery coalesce on the same set).
    fn spawn_transcode(&self, urn: String) {
        let Some(ffmpeg) = self.ffmpeg() else {
            return;
        };
        {
            let Ok(mut set) = self.transcoding.lock() else {
                return;
            };
            if !set.insert(urn.clone()) {
                return;
            }
        }
        let state = self.clone();
        tokio::spawn(async move {
            if let Err(e) = state.run_transcode(&ffmpeg, &urn).await {
                let line = format!("[TrackCache] transcode failed for {urn}: {e}");
                eprintln!("{line}");
                state.diag("WARN", line);
            }
            if let Ok(mut set) = state.transcoding.lock() {
                set.remove(&urn);
            }
        });
    }

    /// Transcode `incoming_dir/<urn>` → clean m4a in the routed dest dir, then
    /// drop the raw file. Validates the result against the API duration and
    /// discards truncated downloads. Caller owns the `transcoding` dedup slot.
    async fn run_transcode(&self, ffmpeg: &Path, urn: &str) -> Result<(), String> {
        let _permit = self
            .transcode_limiter
            .acquire()
            .await
            .map_err(|e| e.to_string())?;

        let incoming = self.incoming_file_path(urn);
        if !is_valid_file(&incoming) {
            return Ok(()); // already promoted, evicted, or never landed
        }

        let meta = read_cache_metadata(&incoming);
        let liked = meta.as_ref().map(|m| m.liked).unwrap_or(false);
        let expected = meta.as_ref().and_then(|m| m.expected_duration_ms);
        let quality = meta
            .as_ref()
            .map(|m| m.quality)
            .unwrap_or(PlaybackQuality::Sq);
        let source = meta.as_ref().and_then(|m| m.source);
        let dest_dir = if liked {
            self.liked_dir.clone()
        } else {
            self.audio_dir.clone()
        };

        // Clean file already present (e.g. promoted by a prior run) — drop the
        // raw file after a grace period (a player may still hold its path).
        if is_valid_file(&dest_dir.join(urn_to_filename(urn))) {
            self.schedule_remove_incoming(urn.to_string());
            return Ok(());
        }

        let final_name = urn_to_filename(urn);
        let clean_path = transcode::transcode_to_m4a(ffmpeg, &incoming, &dest_dir, &final_name).await?;

        let probed = transcode::probe_duration_ms(ffmpeg, &clean_path).await;

        // The transcode faithfully reproduces the source, so a too-short result
        // means the *download* was cut off — discard so the next play retries.
        // But cap retries: if a track is *consistently* short, its only stream is
        // a preview, so accept it (align expected→actual) instead of looping.
        let mut accepted_expected = expected;
        if let (Some(actual), Some(exp)) = (probed, expected)
            && !cached_duration_ok(actual, exp) {
                let attempts = self.note_truncated(urn);
                if attempts <= MAX_TRUNCATED_RETRIES {
                    let line = format!(
                        "[TrackCache] {urn} transcoded short ({actual}ms vs {exp}ms) — discarding (attempt {attempts})"
                    );
                    eprintln!("{line}");
                    self.diag("WARN", line);
                    tokio::fs::remove_file(&clean_path).await.ok();
                    tokio::fs::remove_file(cache_metadata_path(&clean_path)).await.ok();
                    self.remove_incoming(urn).await;
                    return Ok(());
                }
                let line =
                    format!("[TrackCache] {urn}: only a {actual}ms preview is available — keeping it");
                eprintln!("{line}");
                self.diag("WARN", line);
                accepted_expected = probed; // stop flagging this file as truncated
            }
        self.clear_truncated(urn);

        let clean_meta = TrackCacheMetadata {
            quality,
            source,
            liked,
            expected_duration_ms: accepted_expected,
            duration_ms: probed,
        };
        write_cache_metadata(&clean_path, &clean_meta).await;
        // Defer dropping the raw А file: the path may have just been handed to the
        // player, which reads it a moment later in a separate command.
        self.schedule_remove_incoming(urn.to_string());
        println!("[TrackCache] transcoded {urn} → {}", clean_path.display());
        Ok(())
    }

    async fn remove_incoming(&self, urn: &str) {
        let path = self.incoming_file_path(urn);
        tokio::fs::remove_file(&path).await.ok();
        tokio::fs::remove_file(cache_metadata_path(&path)).await.ok();
    }

    /// Delete the raw А file after a grace period, so a path just handed to the
    /// player survives the brief gap before it is read. Re-checks at fire time:
    /// only drops А when its clean Б is present and no fresh transcode is running
    /// (guards against nuking a new download cycle for the same URN).
    fn schedule_remove_incoming(&self, urn: String) {
        let state = self.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_secs(INCOMING_GRACE_SECS)).await;
            let in_flight = state
                .transcoding
                .lock()
                .map(|s| s.contains(&urn))
                .unwrap_or(true);
            if !in_flight && state.resolve_clean_path(&urn).is_some() {
                state.remove_incoming(&urn).await;
            }
        });
    }

    /// Record a "transcoded too short" result and return the running count.
    /// A poisoned lock returns `u8::MAX` so the caller stops retrying (safe).
    fn note_truncated(&self, urn: &str) -> u8 {
        let Ok(mut map) = self.truncated_retries.lock() else {
            return u8::MAX;
        };
        let count = map.entry(urn.to_string()).or_insert(0);
        *count = count.saturating_add(1);
        *count
    }

    fn clear_truncated(&self, urn: &str) {
        if let Ok(mut map) = self.truncated_retries.lock() {
            map.remove(urn);
        }
    }

    /// On startup (after ffmpeg is acquired): re-queue transcodes for any raw
    /// files left in the staging dir by a crash or by downloads that happened
    /// before ffmpeg was ready. Temp files were already swept synchronously in
    /// `init()`, before any live writer could exist.
    pub async fn recover_incoming(&self) {
        if self.ffmpeg().is_none() {
            return;
        }
        let urns = list_incoming_urns(&self.incoming_dir);
        if !urns.is_empty() {
            let line = format!("[TrackCache] recovering {} incoming track(s)", urns.len());
            println!("{line}");
            self.diag("INFO", line);
        }
        for urn in urns {
            self.spawn_transcode(urn);
        }
    }

    /// Ensure a clean m4a exists for export, coalescing with any background
    /// transcode via the shared dedup set. Returns the clean path, or `None` if
    /// no clean file could be produced (caller falls back to the raw bytes).
    async fn ensure_clean_for_export(&self, urn: &str, ffmpeg: &Path) -> Option<PathBuf> {
        if let Some(path) = self.resolve_clean_path(urn) {
            return Some(path);
        }
        let claimed = self
            .transcoding
            .lock()
            .ok()
            .map(|mut set| set.insert(urn.to_string()))
            .unwrap_or(false);
        if claimed {
            let _ = self.run_transcode(ffmpeg, urn).await;
            if let Ok(mut set) = self.transcoding.lock() {
                set.remove(urn);
            }
        } else {
            // A background transcode owns the slot — wait for the clean file.
            for _ in 0..150 {
                if self.resolve_clean_path(urn).is_some() {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(200)).await;
            }
        }
        self.resolve_clean_path(urn)
    }

    async fn fetch_cover(&self, url: &str) -> Option<Vec<u8>> {
        let resp = match tokio::time::timeout(
            Duration::from_millis(TRACK_CACHE_COVER_TIMEOUT_MS),
            self.client.get(url).send(),
        )
        .await
        {
            Ok(Ok(resp)) => resp,
            _ => return None,
        };
        if !resp.status().is_success() {
            return None;
        }
        if resp.content_length().map(|l| l > MAX_COVER_BYTES).unwrap_or(false) {
            return None;
        }
        let bytes = match tokio::time::timeout(
            Duration::from_millis(TRACK_CACHE_COVER_TIMEOUT_MS),
            resp.bytes(),
        )
        .await
        {
            Ok(Ok(bytes)) => bytes,
            _ => return None,
        };
        if bytes.is_empty() || bytes.len() as u64 > MAX_COVER_BYTES {
            return None;
        }
        Some(bytes.to_vec())
    }

    /// Download-to-file: prefer the clean m4a cache, transcode raw bytes when
    /// only those exist, else fetch from streaming — then write `dest_path`
    /// (m4a) with the cover art embedded when ffmpeg is available.
    pub async fn export_track(
        &self,
        req: CacheRequest<'_>,
        dest_path: String,
        cover_url: Option<String>,
    ) -> Result<String, String> {
        let urn = req.urn.to_string();
        let dest = PathBuf::from(&dest_path);

        // Make sure we at least have raw bytes (downloads + spawns bg transcode).
        let entry = self.ensure_cached(req).await?;
        let mut source_path = PathBuf::from(&entry.path);

        if let Some(ffmpeg) = self.ffmpeg() {
            if let Some(clean) = self.ensure_clean_for_export(&urn, &ffmpeg).await {
                source_path = clean;
            }
            if self.is_clean_path(&source_path) {
                let cover = match cover_url {
                    Some(u) if !u.is_empty() => self.fetch_cover(&u).await,
                    _ => None,
                };
                match transcode::export_with_cover(&ffmpeg, &source_path, cover.as_deref(), &dest)
                    .await
                {
                    Ok(()) => return Ok(dest_path),
                    Err(e) if cover.is_some() => {
                        // A bad cover shouldn't sink the download — retry artless.
                        eprintln!("[TrackCache] export with cover failed ({e}), retrying without");
                        transcode::export_with_cover(&ffmpeg, &source_path, None, &dest).await?;
                        return Ok(dest_path);
                    }
                    Err(e) => return Err(e),
                }
            }
        }

        // No clean m4a available (ffmpeg unavailable, or the transcode failed /
        // timed out). Re-resolve in case a concurrent transcode finished and
        // deleted the raw path we held, then only copy if the source is already a
        // valid m4a — never write mismatched bytes into the user's .m4a file.
        let fallback = self.resolve_path(&urn).unwrap_or(source_path);
        if self.is_clean_path(&fallback) || transcode::is_m4a(&fallback).await {
            tokio::fs::copy(&fallback, &dest)
                .await
                .map_err(|e| format!("Copy failed: {e}"))?;
            return Ok(dest_path);
        }
        Err("Cannot export to m4a: audio transcoder is still preparing or unavailable".into())
    }

    /// Try each storage URL once (healthy hosts first), then API URLs with retries.
    async fn download_with_fallback(&self, params: FallbackParams<'_>) -> Result<PathBuf, String> {
        let FallbackParams {
            target_dir,
            urn,
            urls,
            download_urls,
            storage_urls,
            session_id,
            hq,
        } = params;
        let start = std::time::Instant::now();
        let mut last_err = String::from("no stream URLs provided");

        // `/stream` и `/download` сами выбирают direct/temp через hedged headers:
        // предпочтительный тир получает 300 мс форы, затем стартует запасной.
        // Тело читает только победитель, поэтому быстрота не удваивает аудиотрафик.

        // Sort storage URLs: healthy hosts first.
        let mut sorted: Vec<&String> = storage_urls.iter().collect();
        sorted.sort_by_key(|url| {
            let healthy = host_of(url)
                .map(|h| self.storage_host_available(&h))
                .unwrap_or(true);
            if healthy {
                0
            } else {
                1
            }
        });

        // 1. Try storage `/redirect/...` URLs — fast 307 to presigned S3.
        //    Saves storage server bandwidth when the upstream is reachable.
        //    ПРОПУСКАЕМ на проксируемом тире: 307 ведёт на s3 (его НЕ проксируем),
        //    у забаненного он тоже мёртв — бросок туда лишь жрёт connect-таймаут.
        //    На relay/воркер идём сразу к storage-stream (шаг 3).
        for storage_url in &sorted {
            let Some(host) = host_of(storage_url) else {
                continue;
            };
            if !crate::network::edge::is_direct(storage_url) {
                continue;
            }
            let Some(redirect_url) = make_redirect_url(storage_url) else {
                continue;
            };

            let response = match tokio::time::timeout(
                Duration::from_millis(STORAGE_TIMEOUT_MS),
                self.client.get(&redirect_url).send(),
            )
            .await
            {
                Ok(Ok(resp)) => resp,
                Ok(Err(err)) => {
                    eprintln!("[TrackCache] s3 redirect failed for {urn} ({host}): {err}");
                    continue;
                }
                Err(_) => {
                    eprintln!(
                        "[TrackCache] s3 redirect timed out for {urn} ({host}) after {STORAGE_TIMEOUT_MS}ms"
                    );
                    continue;
                }
            };
            if response.status().is_success() {
                let quality = PlaybackQuality::Hq;
                println!("[TrackCache] {urn} → storage (redirect via {host})");
                match write_response_to_cache(
                    target_dir,
                    urn,
                    response,
                    quality,
                    DownloadSource::Storage,
                    self.app_handle.as_ref(),
                )
                .await
                {
                    Ok(result) => {
                        let kb = std::fs::metadata(&result.path)
                            .map(|m| m.len() / 1024)
                            .unwrap_or(0);
                        let ms = start.elapsed().as_millis();
                        println!("[TrackCache] downloaded {urn} via s3 — {kb} KB in {ms}ms");
                        return Ok(result.path);
                    }
                    Err(DownloadError::Fatal(e)) => {
                        eprintln!("[TrackCache] s3 write failed for {urn}: {e}");
                    }
                    Err(DownloadError::Retryable(e)) => {
                        eprintln!("[TrackCache] s3 download failed for {urn}: {e}");
                    }
                }
            } else if response.status().as_u16() == 404 || response.status().as_u16() == 410 {
            } else {
                eprintln!(
                    "[TrackCache] s3 redirect HTTP {} for {urn} ({host})",
                    response.status()
                );
            }
        }

        // 2. Try anon: download directly from SC public API v2.
        //    Saves a hop through our streaming infra when the user can reach
        //    SoundCloud directly.
        match self.anon.get_stream(urn).await {
            Ok(Some(result)) => {
                let line = format!("[TrackCache] {urn} → anon (SC api v2)");
                println!("{line}");
                self.diag("INFO", line);
                match write_bytes_to_cache(
                    target_dir,
                    urn,
                    &result.data,
                    PlaybackQuality::Sq,
                    DownloadSource::Anon,
                )
                .await
                {
                    Ok(res) => {
                        let kb = std::fs::metadata(&res.path)
                            .map(|m| m.len() / 1024)
                            .unwrap_or(0);
                        let ms = start.elapsed().as_millis();
                        let line =
                            format!("[TrackCache] downloaded {urn} via anon — {kb} KB in {ms}ms");
                        println!("{line}");
                        self.diag("INFO", line);
                        return Ok(res.path);
                    }
                    Err(DownloadError::Fatal(e)) => {
                        let line = format!("[TrackCache] anon write failed for {urn}: {e}");
                        eprintln!("{line}");
                        self.diag("ERROR", line);
                    }
                    Err(DownloadError::Retryable(e)) => {
                        let line = format!("[TrackCache] anon write failed for {urn}: {e}");
                        eprintln!("{line}");
                        self.diag("ERROR", line);
                    }
                }
            }
            Ok(None) => {
                let line = format!("[TrackCache] anon: no usable transcoding for {urn}");
                println!("{line}");
                self.diag("INFO", line);
            }
            Err(e) => {
                let line = format!("[TrackCache] anon failed for {urn}: {e}");
                eprintln!("{line}");
                self.diag("WARN", line);
                last_err = format!("anon: {e}");
            }
        }

        // Storage stream — proxies bytes through our storage server. Каждый
        // storage-URL разворачивается в тиры edge: прямой хост → relay →
        // CF-воркеры (X-Target). Транспортный провал тира ротатит на следующий,
        // ответ самого storage (200/404/5xx) — уже результат.
        for storage_url in &sorted {
            let Some(host) = host_of(storage_url) else {
                continue;
            };
            if !self.storage_host_available(&host) {
                continue;
            }

            let mut transport_ok = false;
            for hop in crate::network::edge::plan(storage_url) {
                // Прямой хост — тугой storage_client (1.2 c: быстрый отказ, если
                // забанен). relay тянет мегабайты через полсвета → нужен
                // потоковый клиент (read-timeout, без общего кап-таймаута).
                let client = if hop.tier_label() == "direct" {
                    &self.storage_client
                } else {
                    &self.client
                };
                let request_timeout = if hop.tier_label() == "direct" {
                    Duration::from_millis(STORAGE_TIMEOUT_MS)
                } else {
                    Duration::from_secs(6)
                };
                let response = match tokio::time::timeout(
                    request_timeout,
                    client.get(&hop.url).send(),
                )
                .await
                {
                    Ok(Ok(r)) => r,
                    Ok(Err(err)) => {
                        hop.note(false);
                        eprintln!("[TrackCache] storage {} failed for {urn}: {err}", hop.tier_label());
                        continue;
                    }
                    Err(_) => {
                        hop.note(false);
                        eprintln!(
                            "[TrackCache] storage {} timed out for {urn}",
                            hop.tier_label()
                        );
                        continue;
                    }
                };
                if !crate::network::edge::hop_ok(&hop, &response) {
                    continue; // транспорт тира виноват — исход записан, следующий тир
                }
                transport_ok = true;
                hop.note(response.status().as_u16() < 500);

                let status = response.status();
                if status.is_success() {
                    self.mark_storage_host_ok(&host);
                    println!("[TrackCache] {urn} → storage stream ({host} via {})", hop.tier_label());
                    match write_response_to_cache(
                        target_dir,
                        urn,
                        response,
                        PlaybackQuality::Hq,
                        DownloadSource::Storage,
                        self.app_handle.as_ref(),
                    )
                    .await
                    {
                        Ok(result) => {
                            let kb = std::fs::metadata(&result.path)
                                .map(|m| m.len() / 1024)
                                .unwrap_or(0);
                            let ms = start.elapsed().as_millis();
                            println!(
                                "[TrackCache] downloaded {urn} via storage stream — {kb} KB in {ms}ms"
                            );
                            return Ok(result.path);
                        }
                        Err(DownloadError::Fatal(e)) => {
                            eprintln!("[TrackCache] storage write failed for {urn}: {e}");
                        }
                        Err(DownloadError::Retryable(e)) => {
                            eprintln!("[TrackCache] storage download failed for {urn}: {e}");
                        }
                    }
                } else if matches!(status.as_u16(), 404 | 410) {
                    break; // объект отсутствует — другие тиры не помогут
                } else {
                    eprintln!("[TrackCache] storage HTTP {status} for {urn} ({host})");
                }
            }

            if !transport_ok {
                self.mark_storage_host_failed(&host);
            }
        }

        // Race /download (direct from SC) vs /stream (proxy via streaming API).
        // First success wins, the loser is dropped → reqwest cancels its connection.
        if !download_urls.is_empty() || !urls.is_empty() {
            match self
                .race_direct_and_api(target_dir, urn, download_urls, urls, session_id, hq, start)
                .await
            {
                Ok(path) => return Ok(path),
                Err(err) => {
                    last_err = err;
                }
            }
        }

        eprintln!("[TrackCache] gave up on {urn}: {last_err}");
        Err(last_err)
    }

    /// Resolve a `/download/:urn` endpoint into a cached file.
    /// Returns `Ok(path)` on success, `Err(msg)` if every candidate failed.
    async fn try_direct(
        &self,
        target_dir: &Path,
        urn: &str,
        download_urls: &[String],
        session_id: Option<&str>,
        hq: bool,
        start: std::time::Instant,
    ) -> Result<PathBuf, String> {
        if download_urls.is_empty() {
            return Err("no download_urls".into());
        }
        println!(
            "[TrackCache] direct: trying {urn} via {} endpoint(s)",
            download_urls.len()
        );
        let result = try_download(&self.direct_client, download_urls, session_id, hq)
            .await
            .ok_or_else(|| "direct: no candidate succeeded".to_string())?;
        let quality = result.quality;
        match write_bytes_to_cache(
            target_dir,
            urn,
            &result.data,
            quality,
            DownloadSource::Direct,
        )
        .await
        {
            Ok(res) => {
                let kb = std::fs::metadata(&res.path)
                    .map(|m| m.len() / 1024)
                    .unwrap_or(0);
                let ms = start.elapsed().as_millis();
                let line = format!("[TrackCache] downloaded {urn} via direct — {kb} KB in {ms}ms");
                println!("{line}");
                self.diag("INFO", line);
                Ok(res.path)
            }
            Err(DownloadError::Fatal(e)) | Err(DownloadError::Retryable(e)) => {
                let line = format!("[TrackCache] direct write failed for {urn}: {e}");
                eprintln!("{line}");
                self.diag("ERROR", line);
                Err(e)
            }
        }
    }

    /// Race all `/stream` API URLs in parallel; first success wins, the
    /// rest are dropped → reqwest cancels their connections.
    async fn try_api(
        &self,
        target_dir: &Path,
        urn: &str,
        urls: &[String],
        session_id: Option<&str>,
        start: std::time::Instant,
    ) -> Result<PathBuf, String> {
        if urls.is_empty() {
            return Err("no /stream URLs".into());
        }

        type DownloadFut = std::pin::Pin<
            Box<dyn std::future::Future<Output = (usize, Result<PathBuf, String>)> + Send>,
        >;
        let mut futures: Vec<DownloadFut> = urls
            .iter()
            .enumerate()
            .map(|(i, url)| {
                let state = self.clone();
                let target_dir = target_dir.to_path_buf();
                let urn = urn.to_string();
                let url = url.clone();
                let session_id = session_id.map(str::to_string);
                println!("[TrackCache] trying URL #{} for {urn} - {url}", i + 1);
                Box::pin(async move {
                    let res = state
                        .download_api_with_retries(&target_dir, &urn, &url, session_id.as_deref())
                        .await;
                    (i, res)
                }) as DownloadFut
            })
            .collect();

        let mut last_err = String::from("api: all URLs failed");
        while !futures.is_empty() {
            let ((idx, result), _select_idx, remaining) =
                futures_util::future::select_all(futures).await;
            match result {
                Ok(path) => {
                    let kb = std::fs::metadata(&path)
                        .map(|meta| meta.len() / 1024)
                        .unwrap_or(0);
                    let ms = start.elapsed().as_millis();
                    println!("[TrackCache] downloaded {urn} via api — {kb} KB in {ms}ms");
                    return Ok(path);
                }
                Err(err) => {
                    eprintln!("[TrackCache] {urn} URL #{} failed: {err}", idx + 1);
                    last_err = err;
                    futures = remaining;
                }
            }
        }
        Err(last_err)
    }

    /// Run direct (`/download`) and api (`/stream`) in parallel; first success
    /// returns its path, the loser is cancelled by being dropped.
    // Bundling these into a struct would only push the same 8 args from one
    // call site into a struct literal at the same call site.
    #[allow(clippy::too_many_arguments)]
    async fn race_direct_and_api(
        &self,
        target_dir: &Path,
        urn: &str,
        download_urls: &[String],
        urls: &[String],
        session_id: Option<&str>,
        hq: bool,
        start: std::time::Instant,
    ) -> Result<PathBuf, String> {
        let direct_fut = self.try_direct(target_dir, urn, download_urls, session_id, hq, start);
        let api_fut = self.try_api(target_dir, urn, urls, session_id, start);
        tokio::pin!(direct_fut);
        tokio::pin!(api_fut);

        let mut direct_done = false;
        let mut api_done = false;
        let mut direct_err: Option<String> = None;
        let mut api_err: Option<String> = None;

        loop {
            tokio::select! {
                res = &mut direct_fut, if !direct_done => match res {
                    Ok(path) => return Ok(path),
                    Err(e) => {
                        direct_done = true;
                        direct_err = Some(e);
                    }
                },
                res = &mut api_fut, if !api_done => match res {
                    Ok(path) => return Ok(path),
                    Err(e) => {
                        api_done = true;
                        api_err = Some(e);
                    }
                },
            }
            if direct_done && api_done {
                break;
            }
        }

        let mut parts = Vec::with_capacity(2);
        if let Some(e) = direct_err {
            parts.push(format!("direct: {e}"));
        }
        if let Some(e) = api_err {
            parts.push(format!("api: {e}"));
        }
        Err(parts.join("; "))
    }

    /// Download from a single URL with retries for retryable errors.
    async fn download_api_with_retries(
        &self,
        target_dir: &Path,
        urn: &str,
        url: &str,
        session_id: Option<&str>,
    ) -> Result<PathBuf, String> {
        let mut last_err = String::new();

        for attempt in 0..=RETRY_DELAYS_MS.len() {
            if attempt > 0 {
                eprintln!("[TrackCache] retry #{attempt} for {urn}: {last_err}");
                tokio::time::sleep(Duration::from_millis(RETRY_DELAYS_MS[attempt - 1])).await;
            }

            match download_api(
                &self.client,
                target_dir,
                urn,
                url,
                session_id,
                self.app_handle.as_ref(),
            )
            .await
            {
                Ok(result) => return Ok(result.path),
                Err(DownloadError::Fatal(err)) => return Err(err),
                Err(DownloadError::Retryable(err)) => {
                    last_err = err;
                }
            }
        }

        Err(last_err)
    }

    pub fn cache_size(&self) -> u64 {
        dir_size(&self.audio_dir) + dir_size(&self.incoming_dir)
    }

    pub fn liked_cache_size(&self) -> u64 {
        dir_size(&self.liked_dir)
    }

    pub fn cache_likes_running(&self) -> bool {
        self.likes_running
            .load(std::sync::atomic::Ordering::Relaxed)
    }

    fn liked_has_file(&self, urn: &str) -> bool {
        let path = self.liked_file_path(urn);
        std::fs::metadata(&path)
            .map(|m| m.len() >= MIN_AUDIO_SIZE)
            .unwrap_or(false)
    }

    /// If the track lives only in the regular audio cache, move it to the
    /// protected `liked_dir`. Tries an atomic rename first and falls back to
    /// copy+remove when the dirs are on different filesystems.
    /// Returns `true` when the track ends up in `liked_dir`.
    async fn promote_to_liked(&self, urn: &str) -> bool {
        if self.liked_has_file(urn) {
            return true;
        }
        let audio = self.file_path(urn);
        if !std::fs::metadata(&audio)
            .map(|m| m.len() >= MIN_AUDIO_SIZE)
            .unwrap_or(false)
        {
            return false;
        }

        let liked = self.liked_file_path(urn);
        let audio_meta = cache_metadata_path(&audio);
        let liked_meta = cache_metadata_path(&liked);

        if tokio::fs::rename(&audio, &liked).await.is_ok() {
            tokio::fs::rename(&audio_meta, &liked_meta).await.ok();
            return true;
        }

        let bytes = match tokio::fs::read(&audio).await {
            Ok(bytes) => bytes,
            Err(_) => return false,
        };
        if tokio::fs::write(&liked, &bytes).await.is_err() {
            return false;
        }
        if let Ok(meta_bytes) = tokio::fs::read(&audio_meta).await {
            tokio::fs::write(&liked_meta, &meta_bytes).await.ok();
            tokio::fs::remove_file(&audio_meta).await.ok();
        }
        tokio::fs::remove_file(&audio).await.ok();
        true
    }

    pub fn cancel_cache_likes(&self) {
        self.likes_cancel
            .store(true, std::sync::atomic::Ordering::Relaxed);
    }

    /// Bulk cache liked tracks to the protected `liked_dir`, respecting a
    /// per-instance concurrency limit. Emits progress events and short-circuits
    /// when `cancel_cache_likes` is called. The op is idempotent — already
    /// cached URNs are skipped without emitting a slot.
    pub async fn cache_likes(&self, entries: Vec<LikeCacheEntry>) -> Result<(), String> {
        if self
            .likes_running
            .swap(true, std::sync::atomic::Ordering::Relaxed)
        {
            return Err("cache_likes already running".into());
        }
        self.likes_cancel
            .store(false, std::sync::atomic::Ordering::Relaxed);

        let total = entries.len() as u32;
        let done = Arc::new(std::sync::atomic::AtomicU32::new(0));
        let failed = Arc::new(std::sync::atomic::AtomicU32::new(0));
        let skipped = Arc::new(std::sync::atomic::AtomicU32::new(0));
        let start = std::time::Instant::now();

        self.emit_likes_progress(
            "start",
            total,
            done.load(std::sync::atomic::Ordering::Relaxed),
            failed.load(std::sync::atomic::Ordering::Relaxed),
            skipped.load(std::sync::atomic::Ordering::Relaxed),
            None,
        );

        let mut handles = Vec::with_capacity(entries.len());

        for entry in entries {
            if self.likes_cancel.load(std::sync::atomic::Ordering::Relaxed) {
                break;
            }

            if self.liked_has_file(&entry.urn) {
                skipped.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                done.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                self.emit_likes_progress(
                    "progress",
                    total,
                    done.load(std::sync::atomic::Ordering::Relaxed),
                    failed.load(std::sync::atomic::Ordering::Relaxed),
                    skipped.load(std::sync::atomic::Ordering::Relaxed),
                    Some(&entry.urn),
                );
                continue;
            }

            if self.promote_to_liked(&entry.urn).await {
                skipped.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                done.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                self.emit_likes_progress(
                    "progress",
                    total,
                    done.load(std::sync::atomic::Ordering::Relaxed),
                    failed.load(std::sync::atomic::Ordering::Relaxed),
                    skipped.load(std::sync::atomic::Ordering::Relaxed),
                    Some(&entry.urn),
                );
                continue;
            }

            let Ok(permit) = self.likes_limiter.clone().acquire_owned().await else {
                break;
            };

            let state = self.clone();
            let done = done.clone();
            let failed = failed.clone();
            let skipped = skipped.clone();

            let handle = tokio::spawn(async move {
                let _permit = permit;
                if state
                    .likes_cancel
                    .load(std::sync::atomic::Ordering::Relaxed)
                {
                    return;
                }
                let LikeCacheEntry {
                    urn,
                    urls,
                    download_urls,
                    storage_urls,
                    session_id,
                    hq,
                    duration_ms,
                } = entry;
                let result = state
                    .ensure_cached(CacheRequest {
                        urn: &urn,
                        urls: &urls,
                        download_urls: &download_urls,
                        storage_urls: &storage_urls,
                        session_id: session_id.as_deref(),
                        hq,
                        liked: true,
                        expected_duration_ms: duration_ms,
                    })
                    .await;
                if result.is_err() {
                    failed.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                } else {
                    skipped.fetch_add(0, std::sync::atomic::Ordering::Relaxed);
                }
                done.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                state.emit_likes_progress(
                    "progress",
                    total,
                    done.load(std::sync::atomic::Ordering::Relaxed),
                    failed.load(std::sync::atomic::Ordering::Relaxed),
                    skipped.load(std::sync::atomic::Ordering::Relaxed),
                    Some(&urn),
                );
            });

            handles.push(handle);
        }

        for handle in handles {
            let _ = handle.await;
        }

        let cancelled = self.likes_cancel.load(std::sync::atomic::Ordering::Relaxed);
        self.likes_running
            .store(false, std::sync::atomic::Ordering::Relaxed);
        self.likes_cancel
            .store(false, std::sync::atomic::Ordering::Relaxed);

        let final_done = done.load(std::sync::atomic::Ordering::Relaxed);
        let final_failed = failed.load(std::sync::atomic::Ordering::Relaxed);
        let final_skipped = skipped.load(std::sync::atomic::Ordering::Relaxed);

        self.emit_likes_progress(
            if cancelled { "cancelled" } else { "done" },
            total,
            final_done,
            final_failed,
            final_skipped,
            None,
        );

        println!(
            "[TrackCache] cache_likes {} — done={}/{} failed={} skipped={} in {}ms",
            if cancelled { "cancelled" } else { "finished" },
            final_done,
            total,
            final_failed,
            final_skipped,
            start.elapsed().as_millis()
        );

        Ok(())
    }

    fn emit_likes_progress(
        &self,
        phase: &str,
        total: u32,
        done: u32,
        failed: u32,
        skipped: u32,
        urn: Option<&str>,
    ) {
        let Some(app) = self.app_handle.as_ref() else {
            return;
        };
        let _ = app.emit(
            "track:cache-likes-progress",
            serde_json::json!({
                "phase": phase,
                "total": total,
                "done": done,
                "failed": failed,
                "skipped": skipped,
                "urn": urn,
            }),
        );
    }

    pub fn clear_cache(&self) {
        clear_audio_dir(&self.audio_dir);
        clear_audio_dir(&self.incoming_dir);
    }

    pub fn clear_liked_cache(&self) {
        clear_audio_dir(&self.liked_dir);
    }

    pub fn remove_cached(&self, urn: &str) -> bool {
        let mut removed = false;
        for path in [
            self.liked_file_path(urn),
            self.file_path(urn),
            self.incoming_file_path(urn),
        ] {
            if std::fs::metadata(&path).is_ok() {
                if std::fs::remove_file(&path).is_ok() {
                    removed = true;
                }
                remove_cache_metadata(&path);
            }
        }
        removed
    }

    pub fn list_cached_urns(&self) -> Vec<String> {
        let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
        let mut urns: Vec<String> = Vec::new();
        for dir in [&self.liked_dir, &self.audio_dir, &self.incoming_dir] {
            collect_cached_urns(dir, &mut seen, &mut urns);
        }
        urns
    }

    /// Batched per-track snapshot across Б (liked + audio) and А. Clean dirs are
    /// scanned first so a track mid-promotion (raw kept for the grace window)
    /// reports its clean entry.
    pub fn cache_inventory(&self) -> Vec<CacheInventoryEntry> {
        let mut seen: HashSet<String> = HashSet::new();
        let mut out = Vec::new();
        for (dir, stage, in_liked_dir) in [
            (&self.liked_dir, "clean", true),
            (&self.audio_dir, "clean", false),
            (&self.incoming_dir, "raw", false),
        ] {
            let Ok(entries) = std::fs::read_dir(dir) else {
                continue;
            };
            for entry in entries.flatten() {
                let path = entry.path();
                if !is_audio_cache_file(&path) {
                    continue;
                }
                let Some(urn) = filename_to_urn(&entry.file_name().to_string_lossy()) else {
                    continue;
                };
                let Ok(fs_meta) = entry.metadata() else {
                    continue;
                };
                if !fs_meta.is_file() || fs_meta.len() < MIN_AUDIO_SIZE {
                    continue;
                }
                if !seen.insert(urn.clone()) {
                    continue;
                }
                let modified_at = fs_meta
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_secs());
                let meta = read_cache_metadata(&path);
                out.push(CacheInventoryEntry {
                    urn,
                    bytes: fs_meta.len(),
                    stage,
                    liked: in_liked_dir || meta.as_ref().map(|m| m.liked).unwrap_or(false),
                    quality: meta.as_ref().map(|m| m.quality.label().to_string()),
                    source: meta
                        .as_ref()
                        .and_then(|m| m.source.map(|s| s.label().to_string())),
                    duration_ms: meta.as_ref().and_then(|m| m.duration_ms),
                    expected_duration_ms: meta.as_ref().and_then(|m| m.expected_duration_ms),
                    modified_at,
                });
            }
        }
        out
    }

    pub fn enforce_limit(&self, limit_mb: u64) {
        if limit_mb == 0 {
            return;
        }
        let limit_bytes = limit_mb * 1024 * 1024;

        let mut files: Vec<(PathBuf, u64, std::time::SystemTime)> = Vec::new();
        let mut total = 0u64;

        // URNs with a transcode in flight — their raw source must not be evicted
        // out from under the А→Б promotion.
        let in_flight = self
            .transcoding
            .lock()
            .ok()
            .map(|s| s.clone())
            .unwrap_or_default();

        // Account for both the clean cache ("Б") and any raw staging files ("А")
        // so a build without ffmpeg (which keeps serving raw bytes) stays bounded.
        for dir in [&self.audio_dir, &self.incoming_dir] {
            let is_incoming = *dir == self.incoming_dir;
            let Ok(entries) = std::fs::read_dir(dir) else {
                continue;
            };
            for entry in entries.flatten() {
                let path = entry.path();
                if !is_audio_cache_file(&path) {
                    continue;
                }
                // Protect staged files that are liked-bound or mid-promotion: a
                // raw file evicted here would silently cancel the user's cache and,
                // for liked tracks, defeat the dedicated protected quota.
                if is_incoming {
                    if let Some(urn) = filename_to_urn(&entry.file_name().to_string_lossy())
                        && in_flight.contains(&urn) {
                            continue;
                        }
                    if read_cache_metadata(&path).map(|m| m.liked).unwrap_or(false) {
                        continue;
                    }
                }
                if let Ok(meta) = entry.metadata()
                    && meta.is_file() {
                        let size = meta.len();
                        let accessed = meta
                            .accessed()
                            .or_else(|_| meta.modified())
                            .unwrap_or(std::time::UNIX_EPOCH);
                        total += size;
                        files.push((path, size, accessed));
                    }
            }
        }

        if total <= limit_bytes {
            return;
        }

        let before = total;
        files.sort_by_key(|x| x.2);

        let mut removed = 0u32;
        for (path, size, _) in files {
            if total <= limit_bytes {
                break;
            }
            if std::fs::remove_file(&path).is_ok() {
                remove_cache_metadata(&path);
                total -= size;
                removed += 1;
            }
        }
        println!(
            "[TrackCache] evicted {removed} files, freed {} MB",
            (before - total) / (1024 * 1024)
        );
    }
}
