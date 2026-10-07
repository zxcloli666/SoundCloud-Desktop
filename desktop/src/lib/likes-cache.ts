//! Bulk-кеширование лайков: общий запуск Rust-цикла `track_cache_likes` и
//! подписка на его прогресс. Используется из Settings (CacheCard) и OfflinePage.

import {listen} from '@tauri-apps/api/event';
import {useCallback, useEffect, useRef, useState} from 'react';
import {cacheLikedTracks, cancelCacheLikes, isCacheLikesRunning, type LikeCacheEntry,} from './cache';

export interface CacheLikesProgress {
  phase: 'start' | 'progress' | 'done' | 'cancelled';
  total: number;
  done: number;
  failed: number;
  skipped: number;
  urn?: string | null;
}

/** Собирает заявки по всем лайкам и запускает фоновый цикл в Rust.
 *  Возвращает число поставленных в очередь треков (0 = лайков нет). */
export async function startCacheLikes(): Promise<number> {
  const [
    { fetchLikedTracksSnapshot },
    { buildStorageUrls, downloadFallbackUrls, streamFallbackUrls, getSessionId, isHqStreaming },
    { getOfflineLikedTracks },
    { mergeLikedTracks },
  ] = await Promise.all([
    import('./hooks'),
    import('./api'),
    import('./offline-index'),
    import('./liked-merge'),
  ]);
  const hq = isHqStreaming();
  const sessionId = getSessionId();
  const result = await fetchLikedTracksSnapshot(200).catch(() => null);
  const local = await getOfflineLikedTracks();
  const tracks = result ? mergeLikedTracks(local, result.tracks, result) : local;
  const entries: LikeCacheEntry[] = tracks.map((track) => ({
    urn: track.urn,
    urls: streamFallbackUrls(track.urn, hq),
    downloadUrls: downloadFallbackUrls(track.urn, hq),
    storageUrls: buildStorageUrls(track.urn),
    sessionId,
    hq,
    durationMs: track.duration,
    storageQuality: track._scd_meta?.storage_quality,
  }));
  if (entries.length > 0) {
    await cacheLikedTracks(entries);
  }
  return entries.length;
}

/** Стейт bulk-кеширования: подхватывает уже идущий цикл, слушает прогресс.
 *  `onFinish` зовётся на done/cancelled (например, перечитать инвентарь). */
export function useCacheLikes(onFinish?: (progress: CacheLikesProgress) => void) {
  const [caching, setCaching] = useState(false);
  const [progress, setProgress] = useState<CacheLikesProgress | null>(null);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  useEffect(() => {
    void isCacheLikesRunning().then((running) => {
      if (running) setCaching(true);
    });
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void listen<CacheLikesProgress>('track:cache-likes-progress', (event) => {
      const p = event.payload;
      if (p.phase === 'start') {
        setCaching(true);
        setProgress({ ...p, done: 0, failed: 0, skipped: 0 });
      } else if (p.phase === 'progress') {
        setProgress(p);
      } else {
        setCaching(false);
        setProgress(null);
        finishRef.current?.(p);
      }
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const start = useCallback(async (): Promise<number> => {
    setCaching(true);
    try {
      const queued = await startCacheLikes();
      if (queued === 0) setCaching(false);
      return queued;
    } catch (err) {
      setCaching(false);
      setProgress(null);
      throw err;
    }
  }, []);

  const cancel = useCallback(() => {
    void cancelCacheLikes();
  }, []);

  return { caching, progress, start, cancel };
}
