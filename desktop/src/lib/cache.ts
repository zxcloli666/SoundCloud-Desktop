import { appCacheDir, join } from '@tauri-apps/api/path';
import { exists, mkdir, readDir, readFile, remove, stat, writeFile } from '@tauri-apps/plugin-fs';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { getCacheServerPort } from './cacheServerPort.ts';
import { API_BASE } from './constants';
import { getSessionId } from './http';

const AUDIO_DIR = 'audio';
const MIN_MP3_SIZE = 8192;

let cacheBasePath: string | null = null;

async function getAudioDir(): Promise<string> {
  if (cacheBasePath) return cacheBasePath;
  const base = await appCacheDir();
  cacheBasePath = await join(base, AUDIO_DIR);
  await mkdir(cacheBasePath, { recursive: true });
  return cacheBasePath;
}

function urnToFilename(urn: string): string {
  return `${urn.replace(/:/g, '_')}.mp3`;
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
    if (info.size < MIN_MP3_SIZE) {
      await remove(path).catch(() => {});
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function getCachedData(urn: string): Promise<ArrayBuffer | null> {
  console.log(`💾 [Cache] Requesting cached data for: ${urn}`);
  try {
    const path = await filePath(urn);
    if (!(await exists(path))) {
      console.log(`💾 [Cache] MISS (file not found) for: ${urn}`);
      return null;
    }

    const info = await stat(path);
    if (info.size < MIN_MP3_SIZE) {
      console.warn(`💾 [Cache] MISS (file too small - ${info.size} bytes) for: ${urn}. Deleting.`);
      await remove(path).catch(() => {});
      return null;
    }

    const data = await readFile(path);
    console.log(`💾 [Cache] HIT (size: ${data.length}) for: ${urn}`);
    return data.buffer as ArrayBuffer;
  } catch (e) {
    console.error(`💾[Cache] Error reading cache for ${urn}:`, e);
    return null;
  }
}

function isValidMp3(buffer: ArrayBuffer): boolean {
  const data = new Uint8Array(buffer);
  if (data.length < MIN_MP3_SIZE) return false;
  if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) return true; // ID3
  if (data[0] === 0xff && (data[1] & 0xe0) === 0xe0) return true; // MPEG Sync
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

      if (isValidMp3(buffer)) {
        console.log(`💾 [Cache] Download complete for ${urn}. Valid MP3. Saving...`);
        const path = await filePath(urn);
        await writeFile(path, new Uint8Array(buffer)).catch((e) => console.error('Write fail', e));
      } else {
        console.error(`💾 [Cache] Invalid MP3 received for ${urn}`);
        throw new Error('Invalid MP3');
      }
      return buffer;
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
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
      if (entry.name?.endsWith('.mp3')) {
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
      if (entry.name?.endsWith('.mp3')) {
        await remove(`${dir}/${entry.name}`).catch(() => {});
      }
    }
  } catch (e) {
    console.error('clearCache failed:', e);
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

/** Возвращает HTTP URL на локальный кэш-сервер для трека */
export function getCacheUrl(urn: string): string | null {
  const port = getCacheServerPort();
  if (!port) return null;
  return `http://127.0.0.1:${port}/audio/${urnToFilename(urn)}`;
}
