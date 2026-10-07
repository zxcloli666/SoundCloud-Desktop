import {appCacheDir, join} from '@tauri-apps/api/path';
import {mkdir, readDir, remove, writeFile} from '@tauri-apps/plugin-fs';
import {
  type PlaybackQuality,
  type PlaybackSource,
  type Track,
  type TrackScdMeta,
  usePlayerStore,
} from '../stores/player';
import {useSettingsStore} from '../stores/settings';
import {toScproxyUrl} from './asset-url';
import {CACHE_UNLIMITED, isAudioCacheOff} from './cache-limit';
import {getStaticPort} from './constants';
import {trackedInvoke as invoke} from './diagnostics';
import {sanitizeFilename} from './filename';
import {onIdle} from './idle';
import { isHqStreaming } from './streaming';
import {isPreviewOnly} from './track-access';

type StorageQuality = TrackScdMeta['storage_quality'];

const WALLPAPERS_DIR = 'wallpapers';
const CACHE_MAINTENANCE_INTERVAL_MS = 60 * 1000;
const IMAGE_TRIM_STARTUP_DELAY_MS = 30 * 1000;
const IDLE_TRIM_MS = 15 * 60 * 1000;
const LIMIT_CHANGE_SETTLE_MS = 800;

let cacheMaintenanceStarted = false;
let limitChangeTimer: number | null = null;

/* ── Track cache (Rust) ─────────────────────────────────── */

export interface TrackCacheInfo {
  path: string;
  quality: PlaybackQuality | null;
  source: PlaybackSource | null;
  acceptedShort: boolean;
  pinned: boolean;
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

export function getPinnedUrns(urns: string[]): Promise<string[]> {
  return invoke<string[]>('track_pinned_urns', { urns });
}

export function markTrackPlayed(urn: string): Promise<void> {
  return invoke('track_mark_played', { urn });
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
async function buildCacheRequest(
  urn: string,
  hq: boolean,
  durationMs?: number,
  storageQuality?: StorageQuality,
) {
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
    storageQuality,
  };
}

export function expectedDurationMs(track: Pick<Track, 'duration' | 'access' | 'policy'>) {
  return isPreviewOnly(track) ? undefined : track.duration;
}

export async function ensureTrackCached(
  urn: string,
  highQualityStreaming = isHqStreaming(),
  durationMs?: number,
  storageQuality?: StorageQuality,
): Promise<TrackCacheInfo> {
  const cached = await getCacheInfo(urn);
  if (cached) {
    return cached;
  }

  const request = await buildCacheRequest(urn, highQualityStreaming, durationMs, storageQuality);
  return invoke<TrackCacheInfo>('track_ensure_cached', { request });
}

export async function saveTrackOffline(
  urn: string,
  refetch: boolean,
  durationMs?: number,
  storageQuality?: StorageQuality,
): Promise<TrackCacheInfo> {
  const request = await buildCacheRequest(urn, isHqStreaming(), durationMs, storageQuality);
  return invoke<TrackCacheInfo>('track_save_offline', { request, refetch });
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

export interface BulkCacheEntry {
  urn: string;
  urls: string[];
  downloadUrls: string[];
  storageUrls: string[];
  sessionId: string | null;
  hq: boolean;
  durationMs?: number;
  storageQuality?: StorageQuality;
}

export interface BulkCacheStatus {
  scope: string;
  total: number;
  done: number;
  failed: number;
  skipped: number;
}

export function startBulkCache(scope: string, entries: BulkCacheEntry[]): Promise<void> {
  return invoke('track_bulk_cache_start', { scope, entries });
}

export function getBulkCacheStatus(): Promise<BulkCacheStatus | null> {
  return invoke<BulkCacheStatus | null>('track_bulk_cache_status');
}

export function cancelBulkCache(): Promise<void> {
  return invoke('track_bulk_cache_cancel');
}

export function isAudioCacheDisabled(): boolean {
  return isAudioCacheOff(useSettingsStore.getState().audioCacheLimitMB);
}

export function isHoverPreloadEnabled(): boolean {
  return useSettingsStore.getState().hoverPreload && !isAudioCacheDisabled();
}

function purgePlayedTracks(): Promise<number> {
  const keepUrn = usePlayerStore.getState().currentTrack?.urn ?? null;
  return invoke<number>('track_purge_played', { keepUrn });
}

export async function enforceAudioCacheLimit(
  limitMb = useSettingsStore.getState().audioCacheLimitMB,
): Promise<void> {
  if (limitChangeTimer !== null) return;
  if (isAudioCacheOff(limitMb)) {
    await purgePlayedTracks();
    return;
  }
  if (!limitMb) return;
  await invoke('track_enforce_cache_limit', { limitMb });
}

/* ── Cache maintenance ───────────────────────────────────── */

export function setupCacheMaintenance() {
  if (cacheMaintenanceStarted) return;
  cacheMaintenanceStarted = true;

  void enforceAudioCacheLimit();

  useSettingsStore.subscribe((state, prev) => {
    if (state.audioCacheLimitMB === prev.audioCacheLimitMB) return;
    if (limitChangeTimer !== null) window.clearTimeout(limitChangeTimer);
    limitChangeTimer = window.setTimeout(() => {
      limitChangeTimer = null;
      void enforceAudioCacheLimit();
    }, LIMIT_CHANGE_SETTLE_MS);
  });

  window.setTimeout(() => void enforceImageCacheLimit(), IMAGE_TRIM_STARTUP_DELAY_MS);
  onIdle(IDLE_TRIM_MS, trimWhileIdle);

  // Pause maintenance while the window is hidden — the WebView does not throttle timers.
  let maintenanceTimer: number | null = null;
  const startTimer = () => {
    if (maintenanceTimer !== null) return;
    maintenanceTimer = window.setInterval(() => {
      void enforceAudioCacheLimit();
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

let imageTrimQueue: Promise<unknown> = Promise.resolve();

export function enforceImageCacheLimit(
  limitMb = useSettingsStore.getState().imageCacheLimitMB,
): Promise<unknown> {
  if (limitMb === CACHE_UNLIMITED) return imageTrimQueue;
  imageTrimQueue = imageTrimQueue
    .catch(() => {})
    .then(() => invoke<number>('image_cache_enforce_limit', { limitMb }));
  return imageTrimQueue;
}

function trimWhileIdle() {
  void import('./scproxy').then((m) => m.clearImageUrlMemo());
  void enforceImageCacheLimit();
  void enforceAudioCacheLimit();
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
  const res = await fetch(toScproxyUrl(url, { direct: true }));
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const ct = res.headers.get('content-type') ?? 'image/jpeg';
  const ext = extensionFromType(ct);
  const name = `wallpaper_${Date.now()}${ext}`;
  const dir = await getWallpapersDir();
  const path = await join(dir, name);
  const buffer = await res.arrayBuffer();
  await writeFile(path, new Uint8Array(buffer));
  return name;
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
  storageQuality?: StorageQuality;
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

  const filename = `${sanitizeFilename(`${artist} - ${title}`)}.m4a`;

  const dest = await save({
    defaultPath: filename,
    filters: [{ name: 'Audio', extensions: ['m4a'] }],
  });
  if (!dest) throw new Error('cancelled');

  const hq = isHqStreaming();
  const request = await buildCacheRequest(urn, hq, options.durationMs, options.storageQuality);
  return invoke<string>('track_export', {
    request,
    destPath: dest,
    coverUrl: coverSourceUrl(options.artworkUrl),
    tags: { title, artist },
  });
}

export type ExportFormat = 'm4a' | 'mp3';

export interface ExportToDirOutcome {
  path: string;
  skipped: boolean;
}

export function isMp3ExportSupported(): Promise<boolean> {
  return invoke<boolean>('track_export_mp3_supported');
}

export async function exportTrackToDir(
  track: Track,
  tags: { title: string; artist: string },
  dir: string,
  fileName: string,
  format: ExportFormat,
): Promise<ExportToDirOutcome> {
  const request = await buildCacheRequest(
    track.urn,
    isHqStreaming(),
    expectedDurationMs(track),
    track._scd_meta?.storage_quality,
  );
  return invoke<ExportToDirOutcome>('track_export_to_dir', {
    request,
    dir,
    fileName,
    coverUrl: coverSourceUrl(track.artwork_url),
    format,
    tags,
  });
}
