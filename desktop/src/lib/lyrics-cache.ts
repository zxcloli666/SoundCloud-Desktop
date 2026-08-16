import type { LyricsResult } from './lyrics';
import { tauriStorage } from './tauri-storage';

const STORAGE_KEY = 'lyrics-cache-v1';
const MAX_CACHE_ENTRIES = 120;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface LyricsCacheEntry {
  value: LyricsResult;
  cachedAt: number;
}

type PersistedLyricsCache = Record<string, LyricsCacheEntry>;

let cachePromise: Promise<Map<string, LyricsCacheEntry>> | null = null;

function normalizePart(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

export function trackLyricsCacheKey(scTrackId: string): string {
  return `track:${scTrackId}`;
}

export function searchLyricsCacheKey(artist: string, title: string, durationMs?: number): string {
  const duration = durationMs && durationMs > 0 ? Math.round(durationMs / 1000) : 0;
  return `search:${normalizePart(artist)}:${normalizePart(title)}:${duration}`;
}

export function transcriptionLyricsCacheKey(scTrackId: string): string {
  return `transcription:${scTrackId}`;
}

async function loadCache(): Promise<Map<string, LyricsCacheEntry>> {
  if (!cachePromise) {
    cachePromise = (async () => {
      const raw = await tauriStorage.getItem(STORAGE_KEY);
      if (!raw) return new Map();
      try {
        return new Map(Object.entries(JSON.parse(raw) as PersistedLyricsCache));
      } catch {
        return new Map();
      }
    })();
  }
  return cachePromise;
}

export async function getCachedLyrics(key: string): Promise<LyricsResult | undefined> {
  const cache = await loadCache();
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

export async function cacheLyrics(key: string, value: LyricsResult): Promise<void> {
  const cache = await loadCache();
  cache.set(key, { value, cachedAt: Date.now() });

  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = [...cache.entries()]
      .sort(([, left], [, right]) => left.cachedAt - right.cachedAt)
      .slice(0, cache.size - MAX_CACHE_ENTRIES);
    for (const [oldKey] of oldest) cache.delete(oldKey);
  }

  await tauriStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(cache)));
}
