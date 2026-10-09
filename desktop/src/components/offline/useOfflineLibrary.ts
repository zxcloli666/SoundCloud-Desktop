//! Данные офлайн-страницы: офлайн-индекс (метаданные) + батч-инвентарь файлов
//! (Rust) + живой прогресс докачек. Один IPC-вызов на список, никакого
//! по-трекового дёрганья моста.

import {listen} from '@tauri-apps/api/event';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {type CacheInventoryEntry, getCacheInventory, removeCachedTrack} from '../../lib/cache';
import {fetchLikedTracksSnapshot} from '../../lib/hooks';
import {mergeLikedTracks} from '../../lib/liked-merge';
import {
  forgetCollection,
  getCacheOrder,
  getOfflineCollections,
  getOfflineKeptUrns,
  getOfflineLikedTracks,
  getOfflineTracksByUrns,
  type OfflineCollection,
  saveCacheOrder,
} from '../../lib/offline-index';
import {useAppMode} from '../../stores/app-status';
import type {Track} from '../../stores/player';
import {buildCachedEntries, buildCollectionViews, buildLikesEntries, likedCoverage} from './lib';

const DOWNLOADS_FLUSH_MS = 250;
const INVENTORY_REFRESH_DEBOUNCE_MS = 1500;

export function useOfflineLibrary() {
  const appMode = useAppMode();
  const [loading, setLoading] = useState(true);
  const [likedTracks, setLikedTracks] = useState<Track[]>([]);
  const [inventory, setInventory] = useState<CacheInventoryEntry[]>([]);
  const [resolvedTracks, setResolvedTracks] = useState<Track[]>([]);
  const [cacheOrder, setCacheOrder] = useState<string[]>([]);
  const [downloads, setDownloads] = useState<Record<string, number>>({});
  const [collections, setCollections] = useState<OfflineCollection[]>([]);
  const [collectionTracks, setCollectionTracks] = useState<Track[]>([]);
  const [keptUrns, setKeptUrns] = useState<Set<string>>(() => new Set());
  const bgFetchDone = useRef(false);
  const disposed = useRef(false);

  const refreshInventory = useCallback(async () => {
    try {
      const inv = await getCacheInventory();
      const [tracks, kept] = await Promise.all([
        getOfflineTracksByUrns(inv.map((e) => e.urn)),
        getOfflineKeptUrns(),
      ]);
      if (disposed.current) return;
      setInventory(inv);
      setResolvedTracks(tracks);
      setKeptUrns(new Set(kept));
      // Файл в инвентаре = докачка завершена; чистим прогресс даже если
      // финальное событие не дошло до 1.0.
      const landed = new Set(inv.map((e) => e.urn));
      setDownloads((prev) => {
        const stale = Object.keys(prev).filter((urn) => landed.has(urn));
        if (stale.length === 0) return prev;
        const next = { ...prev };
        for (const urn of stale) delete next[urn];
        return next;
      });
    } catch (error) {
      console.warn('[Offline] Failed to refresh inventory:', error);
    }
  }, []);

  const refreshCollections = useCallback(async () => {
    try {
      const list = await getOfflineCollections();
      const tracks = await getOfflineTracksByUrns([...new Set(list.flatMap((c) => c.trackUrns))]);
      if (disposed.current) return;
      setCollections(list);
      setCollectionTracks(tracks);
    } catch (error) {
      console.warn('[Offline] Failed to load offline playlists:', error);
    }
  }, []);

  useEffect(() => {
    disposed.current = false;
    const load = async () => {
      try {
        const [liked, order] = await Promise.all([getOfflineLikedTracks(), getCacheOrder()]);
        if (disposed.current) return;
        setLikedTracks(liked);
        setCacheOrder(order);
        await Promise.all([refreshInventory(), refreshCollections()]);
      } catch (error) {
        console.warn('[Offline] Failed to load local library:', error);
      } finally {
        if (!disposed.current) setLoading(false);
      }
    };
    void load();
    return () => {
      disposed.current = true;
    };
  }, [refreshInventory, refreshCollections]);

  // Онлайн: дотягиваем полный список лайков с бэка (он же синкает офлайн-индекс).
  useEffect(() => {
    if (appMode !== 'online' || bgFetchDone.current) return;
    let cancelled = false;
    void fetchLikedTracksSnapshot()
      .then(async (result) => {
        bgFetchDone.current = true;
        const local = await getOfflineLikedTracks();
        if (!cancelled) setLikedTracks(mergeLikedTracks(local, result.tracks, result));
      })
      .catch(() => {
        // Офлайн-режим продолжает жить на локальном индексе.
      });
    return () => {
      cancelled = true;
    };
  }, [appMode]);

  // Живой прогресс докачек: копим в ref, флашим в стейт не чаще 4 Гц; докачанный
  // файл с задержкой подтягивает свежий инвентарь.
  useEffect(() => {
    const pending = new Map<string, number>();
    let flushTimer: number | null = null;
    let refreshTimer: number | null = null;
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    const flush = () => {
      flushTimer = null;
      if (pending.size === 0) return;
      const finished = [...pending.entries()].some(([, p]) => p >= 1);
      setDownloads((prev) => {
        const next = { ...prev };
        for (const [urn, p] of pending) {
          if (p >= 1) delete next[urn];
          else next[urn] = p;
        }
        return next;
      });
      pending.clear();
      if (finished) {
        if (refreshTimer !== null) window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(
          () => void refreshInventory(),
          INVENTORY_REFRESH_DEBOUNCE_MS,
        );
      }
    };

    void listen<{ urn: string; progress: number }>('track:download-progress', (event) => {
      pending.set(event.payload.urn, event.payload.progress);
      if (flushTimer === null) flushTimer = window.setTimeout(flush, DOWNLOADS_FLUSH_MS);
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
      if (flushTimer !== null) window.clearTimeout(flushTimer);
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    };
  }, [refreshInventory]);

  const removeCached = useCallback(async (urn: string) => {
    try {
      await removeCachedTrack(urn);
    } catch (error) {
      console.warn('[Offline] Failed to remove cached track:', error);
      return;
    }
    setInventory((prev) => prev.filter((e) => e.urn !== urn));
  }, []);

  const removeCollection = useCallback(
    async (scope: string) => {
      const orphans = await forgetCollection(scope);
      await Promise.all(orphans.map((urn) => removeCachedTrack(urn).catch(() => false)));
      await Promise.all([refreshInventory(), refreshCollections()]);
    },
    [refreshInventory, refreshCollections],
  );

  const reorderCached = useCallback((urns: string[]) => {
    setCacheOrder(urns);
    void saveCacheOrder(urns);
  }, []);

  const invByUrn = useMemo(() => new Map(inventory.map((e) => [e.urn, e])), [inventory]);
  const trackByUrn = useMemo(() => {
    const map = new Map(collectionTracks.map((t) => [t.urn, t]));
    for (const track of resolvedTracks) map.set(track.urn, track);
    for (const track of likedTracks) map.set(track.urn, track);
    return map;
  }, [collectionTracks, resolvedTracks, likedTracks]);

  const likesEntries = useMemo(
    () => buildLikesEntries(likedTracks, inventory, trackByUrn, keptUrns),
    [likedTracks, inventory, trackByUrn, keptUrns],
  );
  const cachedEntries = useMemo(
    () => buildCachedEntries(inventory, trackByUrn),
    [inventory, trackByUrn],
  );

  const collectionViews = useMemo(
    () => buildCollectionViews(collections, invByUrn),
    [collections, invByUrn],
  );

  const stats = useMemo(() => {
    let totalBytes = 0;
    let likedBytes = 0;
    let rawCount = 0;
    for (const e of inventory) {
      totalBytes += e.bytes;
      if (e.liked) likedBytes += e.bytes;
      if (e.stage === 'raw') rawCount += 1;
    }
    return {
      ...likedCoverage(likesEntries),
      cachedCount: inventory.length,
      totalBytes,
      likedBytes,
      rawCount,
    };
  }, [inventory, likesEntries]);

  return {
    loading,
    appMode,
    likesEntries,
    cachedEntries,
    cacheOrder,
    downloads,
    stats,
    collectionViews,
    trackByUrn,
    invByUrn,
    removeCached,
    removeCollection,
    reorderCached,
    refreshInventory,
    refreshCollections,
  };
}
