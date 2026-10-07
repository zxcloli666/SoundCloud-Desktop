use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::Mutex as StdMutex;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use futures_util::StreamExt;
use wreq::Url;
use wreq::Client;
use tauri::Emitter;
use tokio::fs::File;
use tokio::io::{AsyncWriteExt, BufWriter};
use tokio::sync::{Mutex, Notify, OwnedSemaphorePermit, Semaphore};

use crate::app::diagnostics::log_native;
use crate::network::edge::{Hop, Tier};
use crate::network::system_proxy::follow;
use crate::shared::urn::{canonical_track_urn, track_urn_from_storage_name};
use crate::track_cache::api_download::{StreamJob, download_api};
use crate::track_cache::direct_download::try_download;
use crate::track_cache::sc_anon::AnonClient;
use crate::track_cache::transcode;

mod bulk;
mod evict;
mod export;
mod pinned;
mod storage;
mod upgrade;

pub use bulk::{BulkCacheEntry, BulkCacheStatus};
pub use export::ExportOutcome;
use storage::StorageJob;

const MIN_AUDIO_SIZE: u64 = 8192;
const AUDIO_SNIFF_LEN: usize = 16;
const PROGRESS_EMIT_STEP: f64 = 0.01;
const STREAM_WRITE_BUFFER_SIZE: usize = 256 * 1024;
const STORAGE_CONNECT_TIMEOUT_MS: u64 = 800;
const STORAGE_HEADERS_TIMEOUT_MS: u64 = 1200;
const STORAGE_RELAY_HEADERS_TIMEOUT_SECS: u64 = 15;
const STORAGE_COOLDOWN_SECS: u64 = 60;
const PRESIGN_HEADERS_SECS: u64 = 5;
const PRESIGN_ORIGIN: &str = "https://s3.scnative.space/";
const DOWNLOAD_CONNECT_TIMEOUT_MS: u64 = 3_000;
const DOWNLOAD_READ_TIMEOUT_SECS: u64 = 130;
const BODY_STALL_SECS: u64 = 15;
const ANON_READ_TIMEOUT_SECS: u64 = 20;
const HQ_ANON_BACKUP_SECS: u64 = 15;
const DIRECT_CONNECT_TIMEOUT_MS: u64 = 5_000;
const DIRECT_READ_TIMEOUT_SECS: u64 = 70;
const RETRY_DELAYS_MS: [u64; 1] = [600];
const MAX_PARALLEL_PRELOADS: usize = 20;
const MAX_PARALLEL_BULK: usize = 4;
/// Transcoding is CPU-bound; keep it modest so it never starves playback on weak
/// machines. Most cached tracks are already AAC (a near-free remux), so a small
/// pool drains the queue fast in practice.
const MAX_PARALLEL_TRANSCODES: usize = 2;
const CACHE_METADATA_EXT: &str = ".meta.json";
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
    track_urn_from_storage_name(filename.strip_suffix(".audio")?)
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

#[derive(Clone, Copy, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PlaybackQuality {
    Hq,
    Sq,
}

impl PlaybackQuality {
    fn stored_as(quality: Option<&str>) -> Self {
        if quality == Some("hq") {
            Self::Hq
        } else {
            Self::Sq
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::Hq => "hq",
            Self::Sq => "sq",
        }
    }
}

/// Tracks active downloads so duplicate requests coalesce.
struct ActiveDownload {
    notify: Arc<Notify>,
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
    fn label(self) -> &'static str {
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
#[serde(rename_all = "camelCase")]
pub struct TrackCacheEntry {
    pub path: String,
    pub quality: Option<String>,
    pub source: Option<String>,
    pub accepted_short: bool,
    pub pinned: bool,
}

impl TrackCacheEntry {
    fn from_path_and_meta(path: &Path, meta: Option<TrackCacheMetadata>, pinned: bool) -> Self {
        let accepted_short = meta
            .as_ref()
            .is_some_and(|m| m.duration_ms.is_some() && m.duration_ms == m.expected_duration_ms);
        Self {
            path: path.to_string_lossy().into_owned(),
            quality: meta.as_ref().map(|m| m.quality.label().to_string()),
            source: meta.and_then(|m| m.source.map(|s| s.label().to_string())),
            accepted_short,
            pinned,
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

pub(super) enum DownloadError {
    Fatal(String),
    Retryable(String),
}

pub(super) struct DownloadResult {
    pub path: PathBuf,
}

pub struct CacheRequest<'a> {
    pub urn: &'a str,
    pub urls: &'a [String],
    pub download_urls: &'a [String],
    pub storage_urls: &'a [String],
    pub session_id: Option<&'a str>,
    pub hq: bool,
    pub storage_quality: Option<&'a str>,
    pub liked: bool,
    /// API-reported track length (ms), if known — enables truncated-download
    /// detection. `None` falls back to the size + magic-byte gate only.
    pub expected_duration_ms: Option<u64>,
}

struct RaceJob<'a> {
    target_dir: &'a Path,
    urn: &'a str,
    session_id: Option<&'a str>,
    hq: bool,
    start: std::time::Instant,
    receiving: Arc<std::sync::atomic::AtomicBool>,
}

struct FallbackParams<'a> {
    target_dir: &'a Path,
    urn: &'a str,
    urls: &'a [String],
    download_urls: &'a [String],
    storage_urls: &'a [String],
    session_id: Option<&'a str>,
    hq: bool,
    storage_quality: PlaybackQuality,
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

fn rename_legacy_files(dir: &Path) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let Some(urn) = name
            .to_str()
            .and_then(|name| name.strip_suffix(".audio"))
            .and_then(canonical_track_urn)
        else {
            continue;
        };
        let legacy = entry.path();
        let canonical = dir.join(urn_to_filename(&urn));
        if canonical.exists() {
            std::fs::remove_file(&legacy).ok();
            remove_cache_metadata(&legacy);
        } else if std::fs::rename(&legacy, &canonical).is_ok() {
            std::fs::rename(
                cache_metadata_path(&legacy),
                cache_metadata_path(&canonical),
            )
            .ok();
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
    bulk_limiter: Arc<Semaphore>,
    transcode_limiter: Arc<Semaphore>,
    /// URNs with a transcode in flight, so live + recovery requests coalesce.
    transcoding: Arc<StdMutex<HashSet<String>>>,
    probing: Arc<StdMutex<HashSet<PathBuf>>>,
    exporting: Arc<StdMutex<HashMap<String, u32>>>,
    /// Per-URN count of consecutive "transcoded too short" results, to cap
    /// re-downloads of preview-only tracks (best-effort, per session).
    truncated_retries: Arc<StdMutex<HashMap<String, u8>>>,
    bulk_status: Arc<StdMutex<Option<BulkCacheStatus>>>,
    bulk_cancel: Arc<std::sync::atomic::AtomicBool>,
    mp3_encoder: Arc<tokio::sync::OnceCell<bool>>,
    /// Per-host storage circuit breaker: host -> epoch secs of last failure.
    storage_cooldowns: Arc<StdMutex<HashMap<String, u64>>>,
    upgrade_attempts: Arc<StdMutex<HashSet<String>>>,
    anon: Arc<AnonClient>,
}

pub fn init(audio_dir: PathBuf, liked_dir: PathBuf, incoming_dir: PathBuf) -> TrackCacheState {
    // Sweep temps left by an interrupted previous run. Safe here: init() runs
    // during setup, before the webview can issue any download, so nothing the
    // sweep matches is live.
    for dir in [&incoming_dir, &audio_dir, &liked_dir] {
        sweep_temp_files(dir);
        rename_legacy_files(dir);
    }

    let client = follow(sc_fingerprint::builder(None))
        .redirect(wreq::redirect::Policy::limited(10))
        .tcp_nodelay(true)
        .pool_max_idle_per_host(16)
        .connect_timeout(Duration::from_millis(DOWNLOAD_CONNECT_TIMEOUT_MS))
        .read_timeout(Duration::from_secs(DOWNLOAD_READ_TIMEOUT_SECS))
        .build()
        .expect("failed to build reqwest client");

    let storage_client = follow(wreq::Client::builder())
        .redirect(wreq::redirect::Policy::limited(10))
        .tcp_nodelay(true)
        .pool_max_idle_per_host(4)
        .connect_timeout(Duration::from_millis(STORAGE_CONNECT_TIMEOUT_MS))
        .build()
        .expect("failed to build storage client");

    let direct_client = follow(sc_fingerprint::builder(None))
        .redirect(wreq::redirect::Policy::limited(10))
        .tcp_nodelay(true)
        .pool_max_idle_per_host(16)
        .connect_timeout(Duration::from_millis(DIRECT_CONNECT_TIMEOUT_MS))
        .read_timeout(Duration::from_secs(DIRECT_READ_TIMEOUT_SECS))
        .build()
        .expect("failed to build direct client");

    let anon_client = follow(sc_fingerprint::builder(None))
        .redirect(wreq::redirect::Policy::limited(10))
        .tcp_nodelay(true)
        .pool_max_idle_per_host(16)
        .connect_timeout(Duration::from_millis(DOWNLOAD_CONNECT_TIMEOUT_MS))
        .read_timeout(Duration::from_secs(ANON_READ_TIMEOUT_SECS))
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
        bulk_limiter: Arc::new(Semaphore::new(MAX_PARALLEL_BULK)),
        transcode_limiter: Arc::new(Semaphore::new(MAX_PARALLEL_TRANSCODES)),
        transcoding: Arc::new(StdMutex::new(HashSet::new())),
        probing: Arc::new(StdMutex::new(HashSet::new())),
        exporting: Arc::new(StdMutex::new(HashMap::new())),
        truncated_retries: Arc::new(StdMutex::new(HashMap::new())),
        bulk_status: Arc::new(StdMutex::new(None)),
        bulk_cancel: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        mp3_encoder: Arc::new(tokio::sync::OnceCell::new()),
        storage_cooldowns: Arc::new(StdMutex::new(HashMap::new())),
        upgrade_attempts: Arc::new(StdMutex::new(HashSet::new())),
        anon,
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

fn write_cache_metadata_sync(path: &Path, meta: &TrackCacheMetadata) {
    let Ok(raw) = serde_json::to_vec(meta) else {
        return;
    };
    let final_path = cache_metadata_path(path);
    let temp_path = PathBuf::from(format!("{}.tmp", final_path.display()));
    let written = std::fs::write(&temp_path, raw).is_ok();
    if !written || std::fs::rename(&temp_path, &final_path).is_err() {
        std::fs::remove_file(&temp_path).ok();
    }
}

fn move_by_copy(from: &Path, to: &Path) -> bool {
    let temp = PathBuf::from(format!("{}.tmp", to.display()));
    let copied = std::fs::copy(from, &temp).is_ok()
        && std::fs::File::open(&temp)
            .and_then(|f| f.sync_all())
            .is_ok()
        && std::fs::rename(&temp, to).is_ok();
    if !copied {
        std::fs::remove_file(&temp).ok();
        return false;
    }
    if std::fs::remove_file(from).is_err() {
        std::fs::remove_file(to).ok();
        return false;
    }
    true
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

pub(super) async fn write_response_to_cache(
    target_dir: &Path,
    urn: &str,
    response: wreq::Response,
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
        let next = tokio::time::timeout(Duration::from_secs(BODY_STALL_SECS), stream.next()).await;
        let chunk = match next {
            Ok(Some(Ok(chunk))) => chunk,
            Ok(None) => break,
            Ok(Some(Err(err))) => {
                cleanup_temp_file(&temp_path).await;
                return Err(DownloadError::Retryable(format!("body read: {err}")));
            }
            Err(_) => {
                cleanup_temp_file(&temp_path).await;
                return Err(DownloadError::Retryable(format!(
                    "body stalled after {total_size} bytes"
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

fn progress_emitter(
    app_handle: Option<crate::rt::AppHandle>,
    urn: &str,
    source: DownloadSource,
) -> impl Fn(f64) + Send + Sync + 'static {
    let urn = urn.to_string();
    let emitted = AtomicU32::new(0);
    move |progress| {
        let Some(app) = &app_handle else {
            return;
        };
        let progress = progress.clamp(0.0, 1.0);
        let percent = (progress * 100.0) as u32;
        if emitted.fetch_max(percent, Ordering::Relaxed) < percent {
            let _ = app.emit(
                "track:download-progress",
                serde_json::json!({
                    "urn": urn,
                    "progress": progress,
                    "source": source.label(),
                }),
            );
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

pub(super) fn file_len(path: &Path) -> u64 {
    std::fs::metadata(path).map(|meta| meta.len()).unwrap_or(0)
}

impl TrackCacheState {
    pub fn try_acquire_preload_slot(&self) -> Option<OwnedSemaphorePermit> {
        self.preload_limiter.clone().try_acquire_owned().ok()
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
        Some(self.entry_at(&path, meta))
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

    async fn presigned_get(&self, redirect_url: &str) -> Result<wreq::Response, String> {
        let headers = Duration::from_secs(PRESIGN_HEADERS_SECS);
        match tokio::time::timeout(headers, self.client.get(redirect_url).send()).await {
            Ok(Ok(response)) => Ok(response),
            Ok(Err(err)) => {
                let failed_at = err.url().map_or(PRESIGN_ORIGIN, |url| url.as_str());
                crate::network::edge::note_url(failed_at, Tier::Direct, false);
                Err(err.to_string())
            }
            Err(_) => {
                crate::network::edge::note_url(redirect_url, Tier::Direct, false);
                Err(format!("no headers in {}s", headers.as_secs()))
            }
        }
    }

    async fn storage_get(&self, hop: &Hop) -> Result<wreq::Response, String> {
        let (client, headers) = if hop.tier == Tier::Relay {
            (
                &self.client,
                Duration::from_secs(STORAGE_RELAY_HEADERS_TIMEOUT_SECS),
            )
        } else {
            (
                &self.storage_client,
                Duration::from_millis(STORAGE_HEADERS_TIMEOUT_MS),
            )
        };
        match tokio::time::timeout(headers, client.get(&hop.url).send()).await {
            Ok(sent) => sent.map_err(|err| err.to_string()),
            Err(_) => Err(format!("no headers in {}ms", headers.as_millis())),
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
            storage_quality,
            liked,
            expected_duration_ms,
        } = req;
        let expected_duration_ms = expected_duration_ms.filter(|&ms| ms > 0);

        self.stamp_expected_duration(urn, expected_duration_ms).await;
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
                    self.stamp_expected_duration(urn, expected_duration_ms).await;
                    // Re-resolve: the transcode may have already promoted А→Б and
                    // deleted the raw path stored in the slot.
                    let current = self.resolve_path(urn).unwrap_or(path);
                    Ok(self.entry_at(&current, read_cache_metadata(&current)))
                }
                Some(Err(e)) => Err(e),
                None => Err("download completed without result".into()),
            };
        }

        let notify = Arc::new(Notify::new());
        let result_slot: Arc<Mutex<Option<Result<PathBuf, String>>>> = Arc::new(Mutex::new(None));
        active.insert(
            urn.to_string(),
            ActiveDownload {
                notify: notify.clone(),
                result: result_slot.clone(),
            },
        );
        drop(active);

        let download_result = self
            .download_with_fallback(FallbackParams {
                target_dir,
                urn,
                urls,
                download_urls,
                storage_urls,
                session_id,
                hq,
                storage_quality: PlaybackQuality::stored_as(storage_quality),
            })
            .await;

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
            self.entry_at(&current, read_cache_metadata(&current))
        })
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

    async fn stamp_expected_duration(&self, urn: &str, expected_duration_ms: Option<u64>) {
        let Some(expected_duration_ms) = expected_duration_ms else {
            return;
        };
        for path in [
            self.incoming_file_path(urn),
            self.liked_file_path(urn),
            self.file_path(urn),
        ] {
            if !tokio::fs::try_exists(&path).await.unwrap_or(false) {
                continue;
            }
            let Ok(raw) = tokio::fs::read_to_string(cache_metadata_path(&path)).await else {
                continue;
            };
            let Ok(mut meta) = serde_json::from_str::<TrackCacheMetadata>(&raw) else {
                continue;
            };
            if meta.expected_duration_ms.is_none_or(|ms| ms == 0) {
                meta.expected_duration_ms = Some(expected_duration_ms);
                write_cache_metadata(&path, &meta).await;
            }
            if meta.duration_ms.is_none() && self.is_clean_path(&path) {
                self.spawn_duration_probe(path);
            }
        }
    }

    fn spawn_duration_probe(&self, path: PathBuf) {
        let Some(ffmpeg) = self.ffmpeg() else {
            return;
        };
        {
            let Ok(mut probing) = self.probing.lock() else {
                return;
            };
            if !probing.insert(path.clone()) {
                return;
            }
        }
        let state = self.clone();
        tokio::spawn(async move {
            if let Some(duration_ms) = transcode::probe_duration_ms(&ffmpeg, &path).await
                && let Some(mut meta) = read_cache_metadata(&path)
            {
                meta.duration_ms = Some(duration_ms);
                write_cache_metadata(&path, &meta).await;
            }
            if let Ok(mut probing) = state.probing.lock() {
                probing.remove(&path);
            }
        });
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
        let existing = dest_dir.join(urn_to_filename(urn));
        if is_valid_file(&existing) && !upgrade::upgrades_existing(&existing, quality) {
            self.schedule_remove_incoming(urn.to_string());
            return Ok(());
        }

        let final_name = urn_to_filename(urn);
        let clean_path = transcode::transcode_to_m4a(ffmpeg, &incoming, &dest_dir, &final_name).await?;

        let probed = transcode::probe_duration_ms(ffmpeg, &clean_path).await;
        let latest = read_cache_metadata(&incoming);
        let liked = liked || latest.as_ref().is_some_and(|m| m.liked);
        let expected = latest.or(meta).and_then(|m| m.expected_duration_ms);

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
        if liked && !clean_path.starts_with(&self.liked_dir) {
            self.promote_to_liked(urn).await;
        }
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

    async fn download_with_fallback(&self, params: FallbackParams<'_>) -> Result<PathBuf, String> {
        let FallbackParams {
            target_dir,
            urn,
            urls,
            download_urls,
            storage_urls,
            session_id,
            hq,
            storage_quality,
        } = params;
        let start = std::time::Instant::now();
        let mut last_err = String::from("no stream URLs provided");
        let storage = self.storage_job(target_dir, urn, storage_urls, storage_quality, start);
        let storage_after_race = hq && matches!(storage_quality, PlaybackQuality::Sq);

        if !storage_after_race {
            if let Some(path) = self.try_storage_redirect(&storage).await {
                return Ok(path);
            }
            if !hq {
                match self.try_anon(target_dir, urn, start).await {
                    Ok(Some(path)) => return Ok(path),
                    Ok(None) => {}
                    Err(e) => last_err = format!("anon: {e}"),
                }
            }
            if let Some(path) = self.try_storage_stream(&storage).await {
                return Ok(path);
            }
        }

        if !download_urls.is_empty() || !urls.is_empty() {
            let job = RaceJob {
                target_dir,
                urn,
                session_id,
                hq,
                start,
                receiving: Arc::new(std::sync::atomic::AtomicBool::new(false)),
            };
            let race = self.race_direct_and_api(&job, download_urls, urls);
            let result = if hq {
                self.race_with_anon_backup(&job, race, storage_after_race.then_some(&storage))
                    .await
            } else {
                race.await
            };
            match result {
                Ok(path) => return Ok(path),
                Err(err) => {
                    last_err = err;
                }
            }
        } else if hq
            && let Ok(Some(path)) = self
                .sq_fallback(target_dir, urn, start, storage_after_race.then_some(&storage))
                .await
        {
            return Ok(path);
        }

        eprintln!("[TrackCache] gave up on {urn}: {last_err}");
        Err(last_err)
    }

    async fn race_with_anon_backup(
        &self,
        job: &RaceJob<'_>,
        hq_race: impl Future<Output = Result<PathBuf, String>>,
        sq_storage: Option<&StorageJob<'_>>,
    ) -> Result<PathBuf, String> {
        let RaceJob {
            target_dir,
            urn,
            start,
            ..
        } = *job;
        tokio::pin!(hq_race);
        let finished = tokio::select! {
            res = &mut hq_race => Some(res),
            () = tokio::time::sleep(Duration::from_secs(HQ_ANON_BACKUP_SECS)) => None,
        };

        let hq_result = match finished {
            Some(res) => res,
            None if job.receiving.load(std::sync::atomic::Ordering::Relaxed) => hq_race.await,
            None => {
                let line = format!(
                    "[TrackCache] hq sources still silent for {urn}, starting sq fallback alongside"
                );
                println!("{line}");
                self.diag("INFO", line);

                let anon = self.sq_fallback(target_dir, urn, start, sq_storage);
                tokio::pin!(anon);
                return tokio::select! {
                    res = &mut hq_race => match res {
                        Ok(path) => Ok(path),
                        Err(err) => anon.await.ok().flatten().ok_or(err),
                    },
                    res = &mut anon => match res {
                        Ok(Some(path)) => Ok(path),
                        _ => hq_race.await,
                    },
                };
            }
        };

        match hq_result {
            Ok(path) => Ok(path),
            Err(err) => match self.sq_fallback(target_dir, urn, start, sq_storage).await {
                Ok(Some(path)) => Ok(path),
                _ => Err(err),
            },
        }
    }

    async fn sq_fallback(
        &self,
        target_dir: &Path,
        urn: &str,
        start: std::time::Instant,
        storage: Option<&StorageJob<'_>>,
    ) -> Result<Option<PathBuf>, String> {
        if let Some(storage) = storage
            && let Some(path) = self.try_storage(storage).await
        {
            return Ok(Some(path));
        }
        self.try_anon(target_dir, urn, start).await
    }

    async fn try_anon(
        &self,
        target_dir: &Path,
        urn: &str,
        start: std::time::Instant,
    ) -> Result<Option<PathBuf>, String> {
        let progress = progress_emitter(self.app_handle.clone(), urn, DownloadSource::Anon);
        let result = match self.anon.get_stream(urn, &progress).await {
            Ok(Some(result)) => result,
            Ok(None) => {
                let line = format!("[TrackCache] anon: no usable transcoding for {urn}");
                println!("{line}");
                self.diag("INFO", line);
                return Ok(None);
            }
            Err(e) => {
                let line = format!("[TrackCache] anon failed for {urn}: {e}");
                eprintln!("{line}");
                self.diag("WARN", line);
                return Err(e);
            }
        };

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
                let line = format!("[TrackCache] downloaded {urn} via anon — {kb} KB in {ms}ms");
                println!("{line}");
                self.diag("INFO", line);
                Ok(Some(res.path))
            }
            Err(DownloadError::Fatal(e)) | Err(DownloadError::Retryable(e)) => {
                let line = format!("[TrackCache] anon write failed for {urn}: {e}");
                eprintln!("{line}");
                self.diag("ERROR", line);
                Ok(None)
            }
        }
    }

    /// Resolve a `/download/:urn` endpoint into a cached file.
    /// Returns `Ok(path)` on success, `Err(msg)` if every candidate failed.
    async fn try_direct(
        &self,
        job: &RaceJob<'_>,
        download_urls: &[String],
    ) -> Result<PathBuf, String> {
        let RaceJob {
            target_dir,
            urn,
            session_id,
            hq,
            start,
            ..
        } = *job;
        if download_urls.is_empty() {
            return Err("no download_urls".into());
        }
        println!(
            "[TrackCache] direct: trying {urn} via {} endpoint(s)",
            download_urls.len()
        );
        let result = try_download(
            &self.direct_client,
            download_urls,
            session_id,
            hq,
            &job.receiving,
            Arc::new(progress_emitter(
                self.app_handle.clone(),
                urn,
                DownloadSource::Direct,
            )),
        )
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
    async fn try_api(&self, job: &RaceJob<'_>, urls: &[String]) -> Result<PathBuf, String> {
        let RaceJob {
            target_dir,
            urn,
            session_id,
            start,
            ..
        } = *job;
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
                let receiving = job.receiving.clone();
                println!("[TrackCache] trying URL #{} for {urn} - {url}", i + 1);
                Box::pin(async move {
                    let res = state
                        .download_api_with_retries(
                            &target_dir,
                            &urn,
                            &url,
                            session_id.as_deref(),
                            &receiving,
                        )
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
    async fn race_direct_and_api(
        &self,
        job: &RaceJob<'_>,
        download_urls: &[String],
        urls: &[String],
    ) -> Result<PathBuf, String> {
        let direct_fut = self.try_direct(job, download_urls);
        let api_fut = self.try_api(job, urls);
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
        receiving: &std::sync::atomic::AtomicBool,
    ) -> Result<PathBuf, String> {
        let job = StreamJob {
            client: &self.client,
            target_dir,
            urn,
            session_id,
            app_handle: self.app_handle.as_ref(),
            receiving,
        };
        let mut last_err = String::new();

        for attempt in 0..=RETRY_DELAYS_MS.len() {
            if attempt > 0 {
                eprintln!("[TrackCache] retry #{attempt} for {urn}: {last_err}");
                tokio::time::sleep(Duration::from_millis(RETRY_DELAYS_MS[attempt - 1])).await;
            }

            match download_api(&job, url).await {
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

    pub fn demote_from_liked(&self, urn: &str) -> bool {
        let staged = self.incoming_file_path(urn);
        if let Some(mut meta) = read_cache_metadata(&staged).filter(|m| m.liked) {
            meta.liked = false;
            write_cache_metadata_sync(&staged, &meta);
        }

        let liked = self.liked_file_path(urn);
        if !is_valid_file(&liked) {
            return false;
        }
        let audio = self.file_path(urn);
        let liked_meta = cache_metadata_path(&liked);
        let meta = read_cache_metadata(&liked);

        if is_valid_file(&audio) {
            if std::fs::remove_file(&liked).is_err() {
                return false;
            }
        } else if std::fs::rename(&liked, &audio).is_err() && !move_by_copy(&liked, &audio) {
            return false;
        }

        if let Some(mut meta) = meta {
            meta.liked = false;
            write_cache_metadata_sync(&audio, &meta);
        }
        std::fs::remove_file(&liked_meta).ok();
        true
    }

    pub async fn save_offline(
        &self,
        req: CacheRequest<'_>,
        refetch: bool,
    ) -> Result<TrackCacheEntry, String> {
        if refetch {
            self.remove_cached(req.urn);
            if self.is_cached(req.urn) {
                return Err("cached file is in use".into());
            }
        } else {
            self.pin_existing(req.urn).await;
        }
        let urn = req.urn;
        let entry = self.ensure_cached(CacheRequest { liked: true, ..req }).await?;
        self.pin_existing(urn).await;
        Ok(self
            .resolve_path(urn)
            .map(|path| self.entry_at(&path, read_cache_metadata(&path)))
            .unwrap_or(entry))
    }

    async fn pin_existing(&self, urn: &str) {
        let incoming = self.incoming_file_path(urn);
        if is_valid_file(&incoming) {
            self.finalize_incoming(&incoming, true, None).await;
        }
        self.promote_to_liked(urn).await;
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filename_to_urn_decodes_only_canonical_track_files() {
        assert_eq!(
            filename_to_urn("soundcloud_tracks_42.audio").as_deref(),
            Some("soundcloud:tracks:42")
        );
        for name in [
            "42.audio",
            "soundcloud_tracks_42",
            "soundcloud_tracks_042.audio",
            "soundcloud_users_42.audio",
            "soundcloud_tracks_42.audio.meta.json",
        ] {
            assert_eq!(filename_to_urn(name), None, "{name:?}");
        }
    }

    #[test]
    fn legacy_bare_id_files_move_to_canonical_names() {
        let dir = std::env::temp_dir().join(format!("scd-track-cache-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("42.audio"), b"legacy").unwrap();
        std::fs::write(cache_metadata_path(&dir.join("42.audio")), b"{}").unwrap();
        std::fs::write(dir.join("7.audio"), b"duplicate").unwrap();
        std::fs::write(dir.join("soundcloud_tracks_7.audio"), b"kept").unwrap();
        std::fs::write(dir.join("notes.audio"), b"other").unwrap();

        rename_legacy_files(&dir);

        let renamed = dir.join("soundcloud_tracks_42.audio");
        assert_eq!(std::fs::read(&renamed).unwrap(), b"legacy");
        assert!(cache_metadata_path(&renamed).exists());
        assert!(!dir.join("42.audio").exists());
        assert_eq!(
            std::fs::read(dir.join("soundcloud_tracks_7.audio")).unwrap(),
            b"kept"
        );
        assert!(!dir.join("7.audio").exists());
        assert!(dir.join("notes.audio").exists());
        std::fs::remove_dir_all(&dir).ok();
    }

    async fn cached_clean_file(state: &TrackCacheState, urn: &str, duration_ms: u64) -> PathBuf {
        let path = state.file_path(urn);
        std::fs::write(&path, vec![0u8; MIN_AUDIO_SIZE as usize]).unwrap();
        let meta = TrackCacheMetadata {
            quality: PlaybackQuality::Sq,
            source: None,
            liked: false,
            expected_duration_ms: None,
            duration_ms: Some(duration_ms),
        };
        write_cache_metadata(&path, &meta).await;
        path
    }

    pub(super) fn test_state(name: &str) -> (PathBuf, TrackCacheState) {
        let root = std::env::temp_dir().join(format!("track-cache-{name}-{}", std::process::id()));
        std::fs::remove_dir_all(&root).ok();
        let [audio, liked, incoming] = ["audio", "liked", "incoming"].map(|dir| root.join(dir));
        for dir in [&audio, &liked, &incoming] {
            std::fs::create_dir_all(dir).unwrap();
        }
        (root, init(audio, liked, incoming))
    }

    #[tokio::test]
    async fn only_hq_bytes_replace_an_sq_clean_file() {
        let (root, state) = test_state("upgrade");
        let sq = cached_clean_file(&state, "soundcloud:tracks:3", 180_000).await;

        assert!(upgrade::upgrades_existing(&sq, PlaybackQuality::Hq));
        assert!(!upgrade::upgrades_existing(&sq, PlaybackQuality::Sq));

        let mut meta = read_cache_metadata(&sq).unwrap();
        meta.quality = PlaybackQuality::Hq;
        write_cache_metadata(&sq, &meta).await;
        assert!(!upgrade::upgrades_existing(&sq, PlaybackQuality::Hq));
        std::fs::remove_dir_all(&root).ok();
    }

    #[tokio::test]
    async fn stamped_duration_drops_a_short_clean_file() {
        let (root, state) = test_state("stamp");
        let full = cached_clean_file(&state, "soundcloud:tracks:1", 180_000).await;
        let short = cached_clean_file(&state, "soundcloud:tracks:2", 30_000).await;

        state.stamp_expected_duration("soundcloud:tracks:1", Some(181_000)).await;
        state.stamp_expected_duration("soundcloud:tracks:2", Some(181_000)).await;

        let stamped = read_cache_metadata(&full).unwrap().expected_duration_ms;
        assert_eq!(stamped, Some(181_000));
        assert!(state.get_cache_entry("soundcloud:tracks:1").is_some());
        assert!(state.get_cache_entry("soundcloud:tracks:2").is_none());
        assert!(!short.exists());
        std::fs::remove_dir_all(&root).ok();
    }

    #[tokio::test]
    async fn stamp_reaches_a_raw_file_being_transcoded() {
        let (root, state) = test_state("raw-stamp");
        let urn = "soundcloud:tracks:3";
        let raw = state.incoming_file_path(urn);
        std::fs::write(&raw, vec![0u8; MIN_AUDIO_SIZE as usize]).unwrap();
        state.finalize_incoming(&raw, false, None).await;

        state.stamp_expected_duration(urn, Some(181_000)).await;

        let stamped = read_cache_metadata(&raw).unwrap().expected_duration_ms;
        assert_eq!(stamped, Some(181_000));
        std::fs::remove_dir_all(&root).ok();
    }

    #[tokio::test]
    async fn pinning_moves_cached_files_to_the_protected_dir() {
        let (root, state) = test_state("pin");
        let clean = "soundcloud:tracks:6";
        cached_clean_file(&state, clean, 180_000).await;
        let staged = "soundcloud:tracks:7";
        let raw = state.incoming_file_path(staged);
        std::fs::write(&raw, vec![0u8; MIN_AUDIO_SIZE as usize]).unwrap();
        state.finalize_incoming(&raw, false, None).await;

        state.pin_existing(clean).await;
        state.pin_existing(staged).await;

        assert!(state.liked_has_file(clean));
        assert!(!state.file_path(clean).exists());
        assert!(read_cache_metadata(&state.liked_file_path(clean)).is_some());
        assert!(read_cache_metadata(&raw).unwrap().liked);
        std::fs::remove_dir_all(&root).ok();
    }

    #[tokio::test]
    async fn saving_during_an_unpinned_download_still_pins_it() {
        let (root, state) = test_state("save-race");
        let urn = "soundcloud:tracks:8";
        let notify = Arc::new(Notify::new());
        let result: Arc<Mutex<Option<Result<PathBuf, String>>>> = Arc::new(Mutex::new(None));
        state.active.lock().await.insert(
            urn.to_string(),
            ActiveDownload {
                notify: notify.clone(),
                result: result.clone(),
            },
        );
        let preload = {
            let state = state.clone();
            tokio::spawn(async move {
                tokio::time::sleep(Duration::from_millis(50)).await;
                let raw = state.incoming_file_path(urn);
                std::fs::write(&raw, vec![0u8; MIN_AUDIO_SIZE as usize]).unwrap();
                state.finalize_incoming(&raw, false, None).await;
                *result.lock().await = Some(Ok(raw));
                notify.notify_waiters();
                state.active.lock().await.remove(urn);
            })
        };
        let req = CacheRequest {
            urn,
            urls: &[],
            download_urls: &[],
            storage_urls: &[],
            session_id: None,
            hq: false,
            storage_quality: None,
            liked: false,
            expected_duration_ms: None,
        };

        let entry = state.save_offline(req, false).await.unwrap();
        preload.await.unwrap();

        assert!(entry.pinned);
        assert!(state.is_pinned(urn));
        std::fs::remove_dir_all(&root).ok();
    }

    #[tokio::test]
    async fn demoted_like_returns_to_the_audio_cache() {
        let (root, state) = test_state("demote");
        let urn = "soundcloud:tracks:6";
        cached_clean_file(&state, urn, 180_000).await;
        assert!(state.promote_to_liked(urn).await);
        let liked = state.liked_file_path(urn);
        let mut meta = read_cache_metadata(&liked).unwrap();
        meta.liked = true;
        write_cache_metadata(&liked, &meta).await;
        let row = |state: &TrackCacheState| {
            state
                .cache_inventory()
                .into_iter()
                .find(|e| e.urn == urn)
                .unwrap()
        };
        assert!(row(&state).liked);

        assert!(state.demote_from_liked(urn));

        assert!(!liked.exists());
        assert!(!cache_metadata_path(&liked).exists());
        let audio = state.file_path(urn);
        assert!(is_valid_file(&audio));
        let meta = read_cache_metadata(&audio).unwrap();
        assert!(!meta.liked);
        assert_eq!(meta.duration_ms, Some(180_000));
        assert!(!row(&state).liked);
        assert_eq!(state.liked_cache_size(), 0);

        assert!(state.promote_to_liked(urn).await);
        assert!(row(&state).liked);
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn move_by_copy_replaces_the_source() {
        let (root, state) = test_state("move-copy");
        let from = state.liked_file_path("soundcloud:tracks:10");
        let to = state.file_path("soundcloud:tracks:10");
        std::fs::write(&from, b"audio").unwrap();

        assert!(move_by_copy(&from, &to));

        assert!(!from.exists());
        assert_eq!(std::fs::read(&to).unwrap(), b"audio");
        assert!(!PathBuf::from(format!("{}.tmp", to.display())).exists());
        std::fs::remove_dir_all(&root).ok();
    }

    #[tokio::test]
    async fn demoting_a_missing_file_is_a_no_op() {
        let (root, state) = test_state("demote-missing");
        let urn = "soundcloud:tracks:7";
        let other = cached_clean_file(&state, "soundcloud:tracks:8", 180_000).await;

        assert!(!state.demote_from_liked(urn));

        assert!(!state.file_path(urn).exists());
        assert!(!state.liked_file_path(urn).exists());
        assert!(is_valid_file(&other));
        assert_eq!(state.cache_inventory().len(), 1);
        std::fs::remove_dir_all(&root).ok();
    }

    #[tokio::test]
    async fn demote_clears_the_liked_flag_on_a_staged_file() {
        let (root, state) = test_state("demote-staged");
        let urn = "soundcloud:tracks:9";
        let raw = state.incoming_file_path(urn);
        std::fs::write(&raw, vec![0u8; MIN_AUDIO_SIZE as usize]).unwrap();
        state.finalize_incoming(&raw, true, None).await;

        assert!(!state.demote_from_liked(urn));

        assert!(!read_cache_metadata(&raw).unwrap().liked);
        std::fs::remove_dir_all(&root).ok();
    }

    #[tokio::test]
    async fn accepted_preview_is_flagged_as_short() {
        let (root, state) = test_state("accepted-short");
        let preview = cached_clean_file(&state, "soundcloud:tracks:4", 30_000).await;
        cached_clean_file(&state, "soundcloud:tracks:5", 180_000).await;
        let mut meta = read_cache_metadata(&preview).unwrap();
        meta.expected_duration_ms = meta.duration_ms;
        write_cache_metadata(&preview, &meta).await;

        let entry = |urn| state.get_cache_entry(urn).unwrap().accepted_short;
        assert!(entry("soundcloud:tracks:4"));
        assert!(!entry("soundcloud:tracks:5"));
        std::fs::remove_dir_all(&root).ok();
    }
}
