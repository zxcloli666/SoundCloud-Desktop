import { fetchAndCacheTrack, getCacheFilePath, getCacheUrl, isCached } from '../../../lib/cache';

export type PlaybackSource =
  | { type: 'cache'; url: string }
  | { type: 'cache-no-server'; url: null }
  | { type: 'stream'; url: null };

export async function resolvePlaybackSource(urn: string): Promise<PlaybackSource> {
  const cachedPath = await getCacheFilePath(urn);
  if (!cachedPath) {
    return { type: 'stream', url: null };
  }

  const cacheUrl = getCacheUrl(urn);
  if (cacheUrl) {
    return { type: 'cache', url: cacheUrl };
  }

  return { type: 'cache-no-server', url: null };
}

export function warmupTrackCache(urn: string) {
  fetchAndCacheTrack(urn).catch(() => {});
}

let preloadTimer: ReturnType<typeof setTimeout> | null = null;

export function preloadTrackCache(urn: string) {
  if (preloadTimer) clearTimeout(preloadTimer);
  preloadTimer = setTimeout(() => {
    isCached(urn).then((hit) => {
      if (!hit) fetchAndCacheTrack(urn).catch(() => {});
    });
  }, 300);
}

export function preloadQueueCache(queue: Array<{ urn: string }>, queueIndex: number) {
  for (let i = 1; i <= 2; i++) {
    const idx = queueIndex + i;
    if (idx < queue.length) {
      const urn = queue[idx].urn;
      isCached(urn).then((hit) => {
        if (!hit) fetchAndCacheTrack(urn).catch(() => {});
      });
    }
  }
}
