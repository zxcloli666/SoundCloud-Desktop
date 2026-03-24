import { invoke } from '@tauri-apps/api/core';
import { appCacheDir, join } from '@tauri-apps/api/path';
import { exists, mkdir, readDir, remove, stat, writeFile } from '@tauri-apps/plugin-fs';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { getSessionId } from './api';
import { useSettingsStore } from '../stores/settings';

import { API_BASE, getStaticPort } from './constants';

const AUDIO_DIR = 'audio';
const ASSETS_DIR = 'assets';
const WALLPAPERS_DIR = 'wallpapers';
const MIN_AUDIO_SIZE = 8192;
const IDLE_ASSETS_CLEAR_MS = 20 * 60 * 1000;
const CACHE_MAINTENANCE_INTERVAL_MS = 60 * 1000;

let cacheBasePath: string | null = null;
let cacheMaintenanceStarted = false;
let lastUserActivityAt = Date.now();
let assetsClearedDuringIdle = false;

async function getAudioDir(): Promise<string> {
  if (cacheBasePath) return cacheBasePath;
  const base = await appCacheDir();
  cacheBasePath = await join(base, AUDIO_DIR);
  await mkdir(cacheBasePath, { recursive: true });
  return cacheBasePath;
}

function urnToFilename(urn: string): string {
  return `${urn.replace(/:/g, '_')}.audio`;
}

async function filePath(urn: string): Promise<string> {
  const dir = await getAudioDir();
  return await join(dir, urnToFilename(urn));
}

export async function isCached(urn: string): Promise<boolean> {
  try {
    const path = await filePath(urn);
    if (!(await exists(path))) return false;
    const info = await stat(path);
    if (info.size < MIN_AUDIO_SIZE) {
      await remove(path).catch(() => {});
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isValidAudio(buffer: ArrayBuffer): boolean {
  const data = new Uint8Array(buffer);
  if (data.length < MIN_AUDIO_SIZE) return false;
  // ID3 (MP3)
  if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) return true;
  // MPEG Sync (MP3 / ADTS AAC)
  if (data[0] === 0xff && (data[1] & 0xe0) === 0xe0) return true;
  // ftyp (MP4/AAC)
  if (data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) return true;
  // OggS (Ogg Vorbis/Opus)
  if (data[0] === 0x4f && data[1] === 0x67 && data[2] === 0x67 && data[3] === 0x53) return true;
  // RIFF/WAV
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) return true;
  // fLaC
  if (data[0] === 0x66 && data[1] === 0x4c && data[2] === 0x61 && data[3] === 0x43) return true;
  return false;
}

const activeDownloads = new Map<string, Promise<ArrayBuffer>>();

export async function fetchAndCacheTrack(urn: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  if (activeDownloads.has(urn)) {
    console.log(`💾[Cache] Reusing active download for: ${urn}`);
    return activeDownloads.get(urn)!;
  }

  console.log(`💾 [Cache] Starting background fetch for: ${urn}`);

  const promise = (async () => {
    try {
      const sessionId = getSessionId();
      const url = `${API_BASE}/tracks/${encodeURIComponent(urn)}/stream`;

      const res = await tauriFetch(url, {
        headers: sessionId ? { 'x-session-id': sessionId } : {},
        signal,
      });

      if (!res.ok) throw new Error(`Stream ${res.status}`);

      const buffer = await res.arrayBuffer();

      if (isValidAudio(buffer)) {
        console.log(`💾 [Cache] Download complete for ${urn}. Saving...`);
        const path = await filePath(urn);
        await writeFile(path, new Uint8Array(buffer)).catch((e) => console.error('Write fail', e));
        await enforceAudioCacheLimit();
      } else {
        console.error(`💾 [Cache] Invalid audio received for ${urn}`);
        throw new Error('Invalid audio');
      }
      return buffer;
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.warn(`💾[Cache] Fetch ABORTED for ${urn}`);
      } else {
        console.error(`💾[Cache] Fetch failed for ${urn}:`, e);
      }
      throw e;
    }
  })();

  activeDownloads.set(urn, promise);

  try {
    return await promise;
  } finally {
    activeDownloads.delete(urn);
  }
}

export async function getCacheSize(): Promise<number> {
  try {
    const dir = await getAudioDir();
    const entries = await readDir(dir);
    let total = 0;
    for (const entry of entries) {
      if (entry.name && entry.isFile) {
        const info = await stat(`${dir}/${entry.name}`);
        total += info.size;
      }
    }
    return total;
  } catch {
    return 0;
  }
}

export async function clearCache(): Promise<void> {
  try {
    const dir = await getAudioDir();
    const entries = await readDir(dir);
    for (const entry of entries) {
      if (entry.name && entry.isFile) {
        await remove(`${dir}/${entry.name}`).catch(() => {});
      }
    }
  } catch (e) {
    console.error('clearCache failed:', e);
  }
}

export async function enforceAudioCacheLimit(
  limitMb = useSettingsStore.getState().audioCacheLimitMB,
): Promise<void> {
  if (!limitMb || limitMb <= 0) return;

  try {
    const dir = await getAudioDir();
    const entries = await readDir(dir);
    const files: Array<{ path: string; size: number; lastUsed: number }> = [];
    let total = 0;

    for (const entry of entries) {
      if (!entry.name || !entry.isFile) continue;
      const path = `${dir}/${entry.name}`;
      const info = await stat(path);
      const size = info.size ?? 0;
      const lastUsed =
        info.atime?.getTime() ?? info.mtime?.getTime() ?? info.birthtime?.getTime() ?? 0;

      total += size;
      files.push({ path, size, lastUsed });
    }

    const limitBytes = limitMb * 1024 * 1024;
    if (total <= limitBytes) return;

    files.sort((a, b) => a.lastUsed - b.lastUsed);

    for (const file of files) {
      if (total <= limitBytes) break;
      await remove(file.path).catch(() => {});
      total -= file.size;
    }
  } catch (error) {
    console.error('enforceAudioCacheLimit failed:', error);
  }
}

/** Возвращает абсолютный путь к файлу в кэше */
export async function getCacheFilePath(urn: string): Promise<string | null> {
  try {
    const path = await filePath(urn);
    if (!(await exists(path))) return null;
    return path;
  } catch {
    return null;
  }
}

/* ── Assets cache ────────────────────────────────────────── */

let assetsBasePath: string | null = null;

async function getAssetsDir(): Promise<string> {
  if (assetsBasePath) return assetsBasePath;
  const base = await appCacheDir();
  assetsBasePath = await join(base, ASSETS_DIR);
  await mkdir(assetsBasePath, { recursive: true });
  return assetsBasePath;
}

export async function getAssetsCacheSize(): Promise<number> {
  try {
    const dir = await getAssetsDir();
    const entries = await readDir(dir);
    let total = 0;
    for (const entry of entries) {
      if (entry.name) {
        const path = await join(dir, entry.name);
        const info = await stat(path);
        total += info.size;
      }
    }
    return total;
  } catch {
    return 0;
  }
}

export async function clearAssetsCache(): Promise<void> {
  try {
    const dir = await getAssetsDir();
    const entries = await readDir(dir);
    for (const entry of entries) {
      if (entry.name) {
        const path = await join(dir, entry.name);
        await remove(path).catch(() => {});
      }
    }
  } catch (e) {
    console.error('clearAssetsCache failed:', e);
  }
}

export function setupCacheMaintenance() {
  if (cacheMaintenanceStarted) return;
  cacheMaintenanceStarted = true;

  const markUserActive = () => {
    lastUserActivityAt = Date.now();
    assetsClearedDuringIdle = false;
  };

  for (const eventName of ['mousemove', 'mousedown', 'keydown', 'touchstart', 'focus']) {
    window.addEventListener(eventName, markUserActive, { passive: true });
  }

  void enforceAudioCacheLimit();

  useSettingsStore.subscribe((state, prev) => {
    if (state.audioCacheLimitMB !== prev.audioCacheLimitMB) {
      void enforceAudioCacheLimit(state.audioCacheLimitMB);
    }
  });

  window.setInterval(() => {
    void enforceAudioCacheLimit();

    if (assetsClearedDuringIdle) return;
    if (Date.now() - lastUserActivityAt < IDLE_ASSETS_CLEAR_MS) return;

    assetsClearedDuringIdle = true;
    void clearAssetsCache();
  }, CACHE_MAINTENANCE_INTERVAL_MS);
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

/** Скачивает картинку по URL и сохраняет в wallpapers/. Возвращает имя файла. */
export async function downloadWallpaper(url: string): Promise<string> {
  const res = await tauriFetch(url);
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

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function downloadTrack(urn: string, artist: string, title: string): Promise<string> {
  const { save } = await import('@tauri-apps/plugin-dialog');

  const filename = sanitizeFilename(`${artist} - ${title}.mp3`);

  const dest = await save({
    defaultPath: filename,
    filters: [{ name: 'Audio', extensions: ['mp3'] }],
  });
  if (!dest) throw new Error('cancelled');

  // Ensure cached
  let cachedPath = await getCacheFilePath(urn);
  if (!cachedPath) {
    await fetchAndCacheTrack(urn);
    cachedPath = await getCacheFilePath(urn);
  }
  if (!cachedPath) throw new Error('Failed to cache track');

  return invoke<string>('save_track_to_path', { cachePath: cachedPath, destPath: dest });
}
