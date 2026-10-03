import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';
import {ForgeModule} from '../components/offline/ForgeModule';
import {OFFLINE_KEYFRAMES} from '../components/offline/keyframes';
import {filterEntries, sortEntries} from '../components/offline/lib';
import {OfflineHead} from '../components/offline/OfflineHead';
import {OfflineToolbar} from '../components/offline/OfflineToolbar';
import {OfflineTrackList} from '../components/offline/OfflineTrackList';
import {StorageModule} from '../components/offline/StorageModule';
import type {OfflineEntry, OfflineSection, SortMode} from '../components/offline/types';
import {useForgeStatus} from '../components/offline/useForgeStatus';
import {useOfflineLibrary} from '../components/offline/useOfflineLibrary';
import {Atmosphere} from '../components/search/Atmosphere';
import {useAuthStatus} from '../lib/auth-status';
import {ensureTrackCached} from '../lib/cache';
import {useCacheLikes} from '../lib/likes-cache';
import {usePerfMode} from '../lib/perf';
import {useAppStatusStore} from '../stores/app-status';
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
  const perf = usePerfMode();
  const lib = useOfflineLibrary();
  const forge = useForgeStatus();
  const cacheLikes = useCacheLikes(() => void lib.refreshInventory());
  const online = lib.appMode === 'online';
  const authStatus = useAuthStatus({ enabled: online });

  const [section, setSection] = useState<OfflineSection>('likes');
  const [sort, setSort] = useState<SortMode>('custom');
  const [query, setQuery] = useState('');

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
    const base = section === 'likes' ? lib.likesEntries : lib.cachedEntries;
    const filtered = filterEntries(base, query);
    return sortEntries(filtered, sort, section === 'cached' ? lib.cacheOrder : null);
  }, [section, sort, query, lib.likesEntries, lib.cachedEntries, lib.cacheOrder]);

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
    const title = entry?.track.title ?? urn.split(':').pop() ?? urn;
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
      void ensureTrackCached(entry.urn, undefined, entry.track.duration)
        .then(() => lib.refreshInventory())
        .catch((error) => console.warn('[Offline] Failed to cache track:', error));
    },
    [lib.refreshInventory],
  );

  const handleTryOnline = useCallback(() => {
    useAppStatusStore.getState().resetConnectivity();
    navigate('/home');
  }, [navigate]);

  const sortable = section === 'cached' && sort === 'custom' && query.trim() === '';
  const deckBlur = perf.blur(24);
  const emptyText = query.trim()
    ? t('offline.searchEmpty')
    : section === 'likes'
      ? t('offline.likesEmpty')
      : t('offline.cachedEmpty');

  return (
    <div className="relative min-h-full px-5 py-6 md:px-8">
      <style>{OFFLINE_KEYFRAMES}</style>
      <Atmosphere tint={['var(--color-accent)', '#6b7a92']} energy={0.4} />

      <div
        className="relative z-10 mx-auto flex w-full max-w-[1180px] flex-col gap-5"
        style={{ isolation: 'isolate' }}
      >
        <OfflineHead online={online} authStatus={authStatus.data} onTryOnline={handleTryOnline} />

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
                onStartLikes={() => void cacheLikes.start().catch(() => {})}
                onCancelLikes={cacheLikes.cancel}
              />
            </section>

            <OfflineToolbar
              section={section}
              onSection={setSection}
              likesCount={lib.likesEntries.length}
              cachedCount={lib.cachedEntries.length}
              playableCount={playableTracks.length}
              onPlayAll={handlePlayAll}
              onShuffle={handleShuffle}
              query={query}
              onQuery={setQuery}
              sort={sort}
              onSort={setSort}
            />

            <OfflineTrackList
              entries={entries}
              sortable={sortable}
              likesSection={section === 'likes'}
              forgingUrns={forgingUrns}
              downloads={lib.downloads}
              emptyText={emptyText}
              onPlay={handlePlay}
              onDownload={handleDownload}
              onRemove={lib.removeCached}
              onReorder={lib.reorderCached}
            />
          </>
        )}
      </div>
    </div>
  );
});
