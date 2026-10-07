import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useLocation, useNavigate} from 'react-router-dom';
import {toast} from 'sonner';
import {CollectionGrid} from '../components/offline/CollectionGrid';
import {CollectionHeader} from '../components/offline/CollectionHeader';
import {ForgeModule} from '../components/offline/ForgeModule';
import {OFFLINE_KEYFRAMES} from '../components/offline/keyframes';
import {
  buildCollectionEntries,
  filterCollections,
  filterEntries,
  sortEntries,
} from '../components/offline/lib';
import {OfflineHead} from '../components/offline/OfflineHead';
import {OfflineToolbar} from '../components/offline/OfflineToolbar';
import {OfflineTrackList} from '../components/offline/OfflineTrackList';
import {StorageModule} from '../components/offline/StorageModule';
import type {OfflineEntry, OfflineSection, SortMode} from '../components/offline/types';
import {useForgeStatus} from '../components/offline/useForgeStatus';
import {useOfflineLibrary} from '../components/offline/useOfflineLibrary';
import {Atmosphere} from '../components/search/Atmosphere';
import {bulkCacheErrorText, useCacheLikes} from '../lib/bulk-cache';
import {ensureTrackCached} from '../lib/cache';
import {requestProbe, useHostStatusStore} from '../lib/host-status';
import {idOf} from '../lib/ids';
import {usePerfMode} from '../lib/perf';
import {useAppStatusStore} from '../stores/app-status';
import {saveOffline} from '../stores/offline-saves';
import {usePlayerStore} from '../stores/player';

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const OfflinePage = React.memo(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const perf = usePerfMode();
  const lib = useOfflineLibrary();
  const forge = useForgeStatus();
  const cacheLikes = useCacheLikes(() => void lib.refreshInventory());
  const online = lib.appMode === 'online';
  const probing = useHostStatusStore((s) => s.probing);
  const mainUp = useHostStatusStore((s) => s.main === 'up');
  const backendReachable = useAppStatusStore((s) => s.navigatorOnline && s.backendReachable);
  const [tryingOnline, setTryingOnline] = useState(false);

  const initialScope = (location.state as { collection?: string } | null)?.collection ?? null;
  const [section, setSection] = useState<OfflineSection>(initialScope ? 'playlists' : 'likes');
  const [openScope, setOpenScope] = useState<string | null>(initialScope);
  const openView = useMemo(
    () => lib.collectionViews.find((v) => v.scope === openScope) ?? null,
    [lib.collectionViews, openScope],
  );
  const [sort, setSort] = useState<SortMode>('custom');
  const [query, setQuery] = useState('');
  const showGrid = section === 'playlists' && openView === null;
  const gridViews = useMemo(
    () => filterCollections(lib.collectionViews, query),
    [lib.collectionViews, query],
  );

  useEffect(() => {
    if (section === 'likes' && lib.likesEntries.length === 0 && lib.cachedEntries.length > 0) {
      setSection('cached');
    }
    if (section === 'cached' && lib.cachedEntries.length === 0 && lib.likesEntries.length > 0) {
      setSection('likes');
    }
  }, [section, lib.likesEntries.length, lib.cachedEntries.length]);

  // Кузница двигает файлы между А и Б — подтягиваем свежий инвентарь.
  const forgeCounts = forge ? `${forge.incoming}:${forge.clean}` : null;
  const prevForgeCounts = useRef<string | null>(null);
  useEffect(() => {
    if (forgeCounts === null) return;
    if (prevForgeCounts.current !== null && prevForgeCounts.current !== forgeCounts) {
      void lib.refreshInventory();
    }
    prevForgeCounts.current = forgeCounts;
  }, [forgeCounts, lib.refreshInventory]);

  const entries = useMemo(() => {
    const base =
      section === 'likes'
        ? lib.likesEntries
        : section === 'cached'
          ? lib.cachedEntries
          : openView
            ? buildCollectionEntries(openView, lib.trackByUrn, lib.invByUrn)
            : [];
    const filtered = filterEntries(base, query);
    return sortEntries(filtered, sort, section === 'cached' ? lib.cacheOrder : null);
  }, [
    section,
    sort,
    query,
    openView,
    lib.likesEntries,
    lib.cachedEntries,
    lib.cacheOrder,
    lib.trackByUrn,
    lib.invByUrn,
  ]);

  const handleSection = useCallback((next: OfflineSection) => {
    setSection(next);
    setOpenScope(null);
  }, []);

  const handleRemoveCollection = useCallback(() => {
    if (!openScope) return;
    setOpenScope(null);
    void lib.removeCollection(openScope);
  }, [openScope, lib.removeCollection]);

  const playableTracks = useMemo(
    () => entries.filter((e) => e.inv !== null).map((e) => e.track),
    [entries],
  );

  const forgingUrns = useMemo(
    () => new Set(forge?.transcodingUrns ?? []),
    [forge?.transcodingUrns],
  );
  const forgingTitle = useMemo(() => {
    const urn = forge?.transcodingUrns[0];
    if (!urn) return null;
    const entry = lib.cachedEntries.find((e) => e.urn === urn);
    const title = entry?.track.title ?? idOf(urn) ?? urn;
    const extra = (forge?.transcodingUrns.length ?? 0) - 1;
    return extra > 0 ? `${title} +${extra}` : title;
  }, [forge?.transcodingUrns, lib.cachedEntries]);

  const handlePlay = useCallback(
    (entry: OfflineEntry) => {
      void usePlayerStore.getState().play(entry.track, playableTracks);
    },
    [playableTracks],
  );
  const handlePlayAll = useCallback(() => {
    if (playableTracks.length === 0) return;
    void usePlayerStore.getState().play(playableTracks[0], playableTracks);
  }, [playableTracks]);
  const handleShuffle = useCallback(() => {
    if (playableTracks.length === 0) return;
    const q = shuffled(playableTracks);
    void usePlayerStore.getState().play(q[0], q);
  }, [playableTracks]);

  const handleDownload = useCallback(
    (entry: OfflineEntry) => {
      void ensureTrackCached(
        entry.urn,
        undefined,
        entry.track.duration,
        entry.track._scd_meta?.storage_quality,
      )
        .then(() => lib.refreshInventory())
        .catch((error) => console.warn('[Offline] Failed to cache track:', error));
    },
    [lib.refreshInventory],
  );

  const handleRefetch = useCallback(
    (entry: OfflineEntry) => {
      void saveOffline(entry.track, true).then(() => lib.refreshInventory());
    },
    [lib.refreshInventory],
  );

  useEffect(() => {
    if (!tryingOnline || probing) return;
    setTryingOnline(false);
    if (!online && !(backendReachable && mainUp)) return;
    useAppStatusStore.getState().setOfflineBypass(false);
    navigate('/home');
  }, [tryingOnline, online, probing, backendReachable, mainUp, navigate]);

  const handleTryOnline = useCallback(() => {
    setTryingOnline(true);
    requestProbe({ force: true });
  }, []);

  const sortable = section === 'cached' && sort === 'custom' && query.trim() === '';
  const deckBlur = perf.blur(24);
  const emptyText = query.trim()
    ? t('offline.searchEmpty')
    : section === 'likes'
      ? t('offline.likesEmpty')
      : section === 'playlists'
        ? t('offline.playlistsEmpty')
        : t('offline.cachedEmpty');

  return (
    <div className="relative min-h-full px-5 py-6 md:px-8">
      <style>{OFFLINE_KEYFRAMES}</style>
      <Atmosphere tint={['var(--color-accent)', '#6b7a92']} energy={0.4} />

      <div
        className="relative z-10 mx-auto flex w-full max-w-[1180px] flex-col gap-5"
        style={{ isolation: 'isolate' }}
      >
        <OfflineHead online={online} onTryOnline={handleTryOnline} />

        {lib.loading ? (
          <>
            <div className="h-[224px] animate-pulse rounded-[20px] border border-white/[0.06] bg-white/[0.02]" />
            <div className="h-9 w-2/3 animate-pulse rounded-[11px] border border-white/[0.06] bg-white/[0.02]" />
            <div className="h-[480px] animate-pulse rounded-[18px] border border-white/[0.06] bg-white/[0.02]" />
          </>
        ) : (
          <>
            <section
              className="relative grid overflow-hidden rounded-[20px] border border-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_60px_-32px_rgba(0,0,0,0.8)] lg:grid-cols-[minmax(0,1.28fr)_1px_minmax(0,1fr)]"
              style={{
                background:
                  deckBlur > 0
                    ? 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.018))'
                    : 'rgb(17,17,21)',
                backdropFilter: deckBlur > 0 ? `blur(${deckBlur}px) saturate(1.25)` : undefined,
                WebkitBackdropFilter:
                  deckBlur > 0 ? `blur(${deckBlur}px) saturate(1.25)` : undefined,
              }}
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, var(--color-accent-glow) 18%, transparent 42%)',
                }}
              />
              <ForgeModule status={forge} forgingTitle={forgingTitle} />
              <div className="mx-5 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12)_30%,rgba(255,255,255,0.12)_70%,transparent)] lg:mx-0 lg:h-auto lg:w-px lg:bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.12)_30%,rgba(255,255,255,0.12)_70%,transparent)]" />
              <StorageModule
                totalBytes={lib.stats.totalBytes}
                likedBytes={lib.stats.likedBytes}
                fileCount={lib.stats.cachedCount}
                likedCount={lib.stats.likedCount}
                likedCachedCount={lib.stats.likedCachedCount}
                caching={cacheLikes.caching}
                progress={cacheLikes.progress}
                onStartLikes={() =>
                  void cacheLikes.start().catch((err) => toast.error(bulkCacheErrorText(err)))
                }
                onCancelLikes={cacheLikes.cancel}
              />
            </section>

            <OfflineToolbar
              section={section}
              onSection={handleSection}
              likesCount={lib.likesEntries.length}
              cachedCount={lib.cachedEntries.length}
              playlistsCount={lib.collectionViews.length}
              playableCount={playableTracks.length}
              onPlayAll={handlePlayAll}
              onShuffle={handleShuffle}
              query={query}
              onQuery={setQuery}
              sort={sort}
              onSort={setSort}
            />

            {openView && (
              <CollectionHeader
                view={openView}
                onBack={() => setOpenScope(null)}
                onRemove={handleRemoveCollection}
              />
            )}

            {showGrid ? (
              <CollectionGrid views={gridViews} emptyText={emptyText} onOpen={setOpenScope} />
            ) : (
              <OfflineTrackList
                entries={entries}
                sortable={sortable}
                likesSection={section === 'likes'}
                forgingUrns={forgingUrns}
                downloads={lib.downloads}
                emptyText={emptyText}
                onPlay={handlePlay}
                onDownload={handleDownload}
                onRefetch={handleRefetch}
                onRemove={lib.removeCached}
                onReorder={lib.reorderCached}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
});
