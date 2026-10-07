import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef } from 'react';
import { create } from 'zustand';
import i18n from '../i18n';
import type { Track } from '../stores/player';
import {
  type BulkCacheEntry,
  type BulkCacheStatus,
  cancelBulkCache,
  expectedDurationMs,
  getBulkCacheStatus,
  startBulkCache,
} from './cache';

export const LIKES_SCOPE = 'likes';

export const playlistScope = (urn: string) => `playlist:${urn}`;
export const albumScope = (id: string) => `album:${id}`;

export interface BulkCacheProgress extends BulkCacheStatus {
  phase: 'start' | 'progress' | 'done' | 'cancelled';
}

export class BulkCacheBusyError extends Error {
  constructor(readonly scope: string) {
    super(`busy:${scope}`);
  }
}

interface BulkCacheStore {
  active: BulkCacheProgress | null;
  preparing: string | null;
  finished: BulkCacheProgress | null;
}

const useBulkCacheStore = create<BulkCacheStore>(() => ({
  active: null,
  preparing: null,
  finished: null,
}));

let wired = false;

function wireBulkCache() {
  if (wired) return;
  wired = true;
  void getBulkCacheStatus()
    .then((status) => {
      if (status && !useBulkCacheStore.getState().active) {
        useBulkCacheStore.setState({ active: { ...status, phase: 'progress' } });
      }
    })
    .catch(() => {});
  void listen<BulkCacheProgress>('track:bulk-cache-progress', ({ payload }) => {
    if (payload.phase === 'start' || payload.phase === 'progress') {
      useBulkCacheStore.setState({ active: payload });
    } else {
      useBulkCacheStore.setState({ active: null, finished: payload });
    }
  });
}

async function buildEntries(tracks: Track[]): Promise<BulkCacheEntry[]> {
  const {
    buildStorageUrls,
    downloadFallbackUrls,
    streamFallbackUrls,
    getSessionId,
    isHqStreaming,
  } = await import('./api');
  const hq = isHqStreaming();
  const sessionId = getSessionId();
  const seen = new Set<string>();
  const entries: BulkCacheEntry[] = [];
  for (const track of tracks) {
    if (!track?.urn || seen.has(track.urn)) continue;
    seen.add(track.urn);
    entries.push({
      urn: track.urn,
      urls: streamFallbackUrls(track.urn, hq),
      downloadUrls: downloadFallbackUrls(track.urn, hq),
      storageUrls: buildStorageUrls(track.urn),
      sessionId,
      hq,
      durationMs: expectedDurationMs(track),
      storageQuality: track._scd_meta?.storage_quality,
    });
  }
  return entries;
}

export function bulkCacheErrorText(error: unknown): string {
  if (!(error instanceof BulkCacheBusyError)) return i18n.t('common.error');
  const kind = error.scope.split(':')[0];
  return i18n.t('offline.bulkBusy', { context: kind });
}

function busyScopeOf(error: unknown): string | null {
  const text = String(error);
  const at = text.indexOf('busy:');
  return at === -1 ? null : text.slice(at + 5);
}

export function useBulkCache(
  scope: string,
  collect: () => Promise<Track[]>,
  onFinish?: (progress: BulkCacheProgress) => void,
) {
  const active = useBulkCacheStore((s) => s.active);
  const preparing = useBulkCacheStore((s) => s.preparing);
  const collectRef = useRef(collect);
  collectRef.current = collect;
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  useEffect(() => {
    wireBulkCache();
    return useBulkCacheStore.subscribe((state, prev) => {
      if (state.finished && state.finished !== prev.finished && state.finished.scope === scope) {
        finishRef.current?.(state.finished);
      }
    });
  }, [scope]);

  const caching = preparing === scope || active?.scope === scope;
  const busyScope = caching ? null : (active?.scope ?? preparing);
  const progress = active?.scope === scope ? active : null;

  const start = useCallback(async (): Promise<number> => {
    const { active: running, preparing: pending } = useBulkCacheStore.getState();
    const other = running?.scope ?? pending;
    if (other) throw new BulkCacheBusyError(other);
    useBulkCacheStore.setState({ preparing: scope });
    try {
      const entries = await buildEntries(await collectRef.current());
      if (entries.length === 0) return 0;
      const finishedBefore = useBulkCacheStore.getState().finished;
      await startBulkCache(scope, entries);
      const now = useBulkCacheStore.getState();
      if (!now.active && now.finished === finishedBefore) {
        useBulkCacheStore.setState({
          active: { phase: 'start', scope, total: entries.length, done: 0, failed: 0, skipped: 0 },
        });
      }
      return entries.length;
    } catch (error) {
      const busy = busyScopeOf(error);
      throw busy ? new BulkCacheBusyError(busy) : error;
    } finally {
      useBulkCacheStore.setState({ preparing: null });
    }
  }, [scope]);

  const cancel = useCallback(() => {
    void cancelBulkCache();
  }, []);

  return { caching, busyScope, progress, start, cancel };
}

const collectLikes = async () => {
  const [{ fetchLikedTracksSnapshot }, { getOfflineLikedTracks }, { mergeLikedTracks }] =
    await Promise.all([import('./hooks'), import('./offline-index'), import('./liked-merge')]);
  const result = await fetchLikedTracksSnapshot(200).catch(() => null);
  const local = await getOfflineLikedTracks();
  return result ? mergeLikedTracks(local, result.tracks, result) : local;
};

export function useCacheLikes(onFinish?: (progress: BulkCacheProgress) => void) {
  return useBulkCache(LIKES_SCOPE, collectLikes, onFinish);
}
