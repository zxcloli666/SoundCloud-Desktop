import { appCacheDir, join } from '@tauri-apps/api/path';
import { mkdir, readDir, remove, writeFile } from '@tauri-apps/plugin-fs';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import type { PlaybackQuality, PlaybackSource } from '../stores/player';
import { useSettingsStore } from '../stores/settings';
import { toScproxyUrl } from './asset-url';
import { getStaticPort } from './constants';
import { trackedInvoke as invoke } from './diagnostics';

const WALLPAPERS_DIR = 'wallpapers';
const CACHE_MAINTENANCE_INTERVAL_MS = 60 * 1000;
const IMAGE_CACHE_MAINTENANCE_INTERVAL_MS = 30 * 60 * 1000;
const IMAGE_CACHE_LIMIT_MB = 384;
const WALLPAPER_FETCH_TIMEOUT_MS = 12_000;

let cacheMaintenanceStarted = false;

/* ── Track cache (Rust) ─────────────────────────────────── */

export interface TrackCacheInfo {
  path: string;
  quality: PlaybackQuality | null;
  source: PlaybackSource | null;
}

export function isCached(urn: string): Promise<boolean> {
  return invoke<boolean>('track_is_cached', { urn });
}

export function getCacheFilePath(urn: string): Promise<string | null> {
  return invoke<string | null>('track_get_cache_path', { urn });
}

export function getCacheInfo(urn: string): Promise<TrackCacheInfo | null> {
  return invoke<TrackCacheInfo | null>('track_get_cache_info', { urn });
}

export function cancelTrackDownload(urn: string): Promise<boolean> {
  return invoke<boolean>('track_cancel_download', { urn });
}

export type FfmpegState = 'ready' | 'preparing' | 'unavailable';

/** Live snapshot of the А→Б transcode pipeline (Rust `TranscodeStatus`). */
export interface TranscodeStatus {
  ffmpeg: FfmpegState;
  /** Raw files staged in folder А, awaiting transcode. */
  incoming: number;
  incomingBytes: number;
  /** Transcodes running right now. */
  transcoding: number;
  /** URNs being forged right now, for per-row UI state. */
  transcodingUrns: string[];
  /** Clean m4a files in folder Б (regular + liked). */
  clean: number;
  cleanBytes: number;
}

export function getTranscodeStatus(): Promise<TranscodeStatus> {
  return invoke<TranscodeStatus>('track_transcode_status');
}

/** Builds the Rust-side cache request (stream/download/storage fallbacks + the
 *  API duration used to detect truncated downloads). `durationMs` is the track's
 *  API-reported length in milliseconds. */
export async function buildTrackRequest(urn: string, hq: boolean, durationMs?: number) {
  const { buildStorageUrls, downloadFallbackUrls, streamFallbackUrls, getSessionId } = await import(
    './api'
  );
  return {
    urn,
    urls: streamFallbackUrls(urn, hq),
    downloadUrls: downloadFallbackUrls(urn, hq),
    storageUrls: buildStorageUrls(urn),
    sessionId: getSessionId(),
    hq,
    durationMs,
  };
}

export async function ensureTrackCached(
  urn: string,
  highQualityStreaming = useSettingsStore.getState().highQualityStreaming,
  durationMs?: number,
): Promise<TrackCacheInfo> {
  const cached = await getCacheInfo(urn);
  if (cached) {
    return cached;
  }

  const request = await buildTrackRequest(urn, highQualityStreaming, durationMs);
  return invoke<TrackCacheInfo>('track_ensure_cached', { request });
}

export function getCacheSize(): Promise<number> {
  return invoke<number>('track_cache_size');
}

export function getLikedCacheSize(): Promise<number> {
  return invoke<number>('track_liked_cache_size');
}

export function clearCache(): Promise<void> {
  return invoke('track_clear_cache');
}

export function clearLikedCache(): Promise<void> {
  return invoke('track_clear_liked_cache');
}

export function removeCachedTrack(urn: string): Promise<boolean> {
  return invoke<boolean>('track_remove_cached', { urn });
}

export function listCachedUrns(): Promise<string[]> {
  return invoke<string[]>('track_list_cached');
}

/** One row of the batched offline-page inventory (Rust `CacheInventoryEntry`):
 *  per-track file facts in a single IPC round-trip. */
export interface CacheInventoryEntry {
  urn: string;
  bytes: number;
  /** "clean" = transcoded m4a (Б), "raw" = staged for transcode (А). */
  stage: 'clean' | 'raw';
  liked: boolean;
  quality: PlaybackQuality | null;
  source: PlaybackSource | null;
  /** Probed length of the clean file (ms); null for raw/legacy files. */
  durationMs: number | null;
  expectedDurationMs: number | null;
  /** Last modification, epoch seconds. */
  modifiedAt: number | null;
}

export function getCacheInventory(): Promise<CacheInventoryEntry[]> {
  return invoke<CacheInventoryEntry[]>('track_cache_inventory');
}

export interface LikeCacheEntry {
  urn: string;
  urls: string[];
  downloadUrls: string[];
  storageUrls: string[];
  sessionId: string | null;
  hq: boolean;
  /** API track length (ms) — enables truncated-download detection in Rust. */
  durationMs?: number;
}

export function cacheLikedTracks(entries: LikeCacheEntry[]): Promise<void> {
  return invoke('track_cache_likes', { entries });
}

export function isCacheLikesRunning(): Promise<boolean> {
  return invoke<boolean>('track_cache_likes_running');
}

export function cancelCacheLikes(): Promise<void> {
  return invoke('track_cancel_cache_likes');
}

export function enforceAudioCacheLimit(
  limitMb = useSettingsStore.getState().audioCacheLimitMB,
): Promise<void> {
  if (!limitMb || limitMb <= 0) return Promise.resolve();
  return invoke('track_enforce_cache_limit', { limitMb });
}

/* ── Cache maintenance ───────────────────────────────────── */

export function setupCacheMaintenance() {
  if (cacheMaintenanceStarted) return;
  cacheMaintenanceStarted = true;

  void enforceAudioCacheLimit();
  void enforceImageCacheLimit();
  let lastImageMaintenance = Date.now();

  useSettingsStore.subscribe((state, prev) => {
    if (state.audioCacheLimitMB !== prev.audioCacheLimitMB) {
      void enforceAudioCacheLimit(state.audioCacheLimitMB);
    }
  });

  // Pause maintenance while the window is hidden — the WebView does not throttle timers.
  let maintenanceTimer: number | null = null;
  const startTimer = () => {
    if (maintenanceTimer !== null) return;
    maintenanceTimer = window.setInterval(() => {
      void enforceAudioCacheLimit();
      if (Date.now() - lastImageMaintenance >= IMAGE_CACHE_MAINTENANCE_INTERVAL_MS) {
        lastImageMaintenance = Date.now();
        void enforceImageCacheLimit();
      }
    }, CACHE_MAINTENANCE_INTERVAL_MS);
  };
  const stopTimer = () => {
    if (maintenanceTimer === null) return;
    window.clearInterval(maintenanceTimer);
    maintenanceTimer = null;
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopTimer();
    } else {
      void enforceAudioCacheLimit();
      if (Date.now() - lastImageMaintenance >= IMAGE_CACHE_MAINTENANCE_INTERVAL_MS) {
        lastImageMaintenance = Date.now();
        void enforceImageCacheLimit();
      }
      startTimer();
    }
  });

  if (document.visibilityState !== 'hidden') startTimer();
}

/* ── Image cache (permanent, Rust) ───────────────────────── */

export function getImageCacheSize(): Promise<number> {
  return invoke<number>('image_cache_size');
}

export function clearImageCache(): Promise<void> {
  return invoke('image_cache_clear');
}

export function enforceImageCacheLimit(limitMb = IMAGE_CACHE_LIMIT_MB): Promise<number> {
  return invoke<number>('image_cache_enforce_limit', { limitMb });
}

/* ── Wallpapers ──────────────────────────────────────────── */

let wallpapersBasePath: string | null = null;

async function getWallpapersDir(): Promise<string> {
  if (wallpapersBasePath) return wallpapersBasePath;
  const base = await appCacheDir();
  wallpapersBasePath = await join(base, WALLPAPERS_DIR);
  await mkdir(wallpapersBasePath, { recursive: true });
  return wallpapersBasePath;
}

function extensionFromType(mime: string): string {
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('svg')) return '.svg';
  return '.jpg';
}

/** Скачивает картинку по URL и сохраняет в wallpapers/. Возвращает имя файла.
 *  Идём через локальный прокси в режиме `direct` — он фетчит с браузерным UA
 *  (Wallhaven/Konachan 403-ят не-браузер), webview-fetch так не умеет. */
export async function downloadWallpaper(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WALLPAPER_FETCH_TIMEOUT_MS);

  try {
    const res = await tauriFetch(toScproxyUrl(url, { direct: true }), {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const ct = res.headers.get('content-type') ?? 'image/jpeg';
    const ext = extensionFromType(ct);
    const name = `wallpaper_${Date.now()}${ext}`;
    const dir = await getWallpapersDir();
    const path = await join(dir, name);
    const buffer = await res.arrayBuffer();
    await writeFile(path, new Uint8Array(buffer));
    return name;
  } finally {
    clearTimeout(timer);
  }
}

/** Сохраняет ArrayBuffer (из input type=file) как wallpaper. Возвращает имя файла. */
export async function saveWallpaperFromBuffer(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<string> {
  const dir = await getWallpapersDir();
  const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '.jpg';
  const name = `wallpaper_${Date.now()}${ext}`;
  const path = await join(dir, name);
  await writeFile(path, new Uint8Array(buffer));
  return name;
}

/** Получить имена всех сохранённых wallpapers */
export async function listWallpapers(): Promise<string[]> {
  try {
    const dir = await getWallpapersDir();
    const entries = await readDir(dir);
    const names: string[] = [];
    for (const entry of entries) {
      if (entry.name && /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(entry.name)) {
        names.push(entry.name);
      }
    }
    return names;
  } catch {
    return [];
  }
}

/** Удалить wallpaper по имени файла */
export async function removeWallpaper(name: string): Promise<void> {
  const dir = await getWallpapersDir();
  const path = await join(dir, name);
  await remove(path).catch(() => {});
}

/** HTTP URL для wallpaper по имени файла */
export function getWallpaperUrl(name: string): string | null {
  const port = getStaticPort();
  if (!port) return null;
  return `http://127.0.0.1:${port}/wallpapers/${encodeURIComponent(name)}`;
}

/* ── Track Download ──────────────────────────────────────── */

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Raw (un-proxied) SoundCloud artwork URL at high res, for Rust to fetch and
 *  embed into the exported file. Returns null when the track has no artwork. */
function coverSourceUrl(artworkUrl: string | null | undefined): string | null {
  if (!artworkUrl) return null;
  return artworkUrl.replace('-large', '-t500x500');
}

export interface DownloadTrackOptions {
  artworkUrl?: string | null;
  /** Track length in milliseconds (API `duration`). */
  durationMs?: number;
}

/** Download-to-file: writes a clean m4a (transcoding/fetching as needed) with
 *  the cover art embedded. Rust resolves the clean cache → raw cache → stream. */
export async function downloadTrack(
  urn: string,
  artist: string,
  title: string,
  options: DownloadTrackOptions = {},
): Promise<string> {
  const { save } = await import('@tauri-apps/plugin-dialog');

  const filename = sanitizeFilename(`${artist} - ${title}.m4a`);

  const dest = await save({
    defaultPath: filename,
    filters: [{ name: 'Audio', extensions: ['m4a'] }],
  });
  if (!dest) throw new Error('cancelled');

  const hq = useSettingsStore.getState().highQualityStreaming;
  const request = await buildTrackRequest(urn, hq, options.durationMs);
  return invoke<string>('track_export', {
    request,
    destPath: dest,
    coverUrl: coverSourceUrl(options.artworkUrl),
  });
}
