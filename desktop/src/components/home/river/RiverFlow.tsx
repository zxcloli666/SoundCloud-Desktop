//! Шелл «Течения»: данные волны (кластеры + бесконечный рефилл очереди) и
//! композиция русла с притоками вдоль реки. Контракты не трогать:
//! useInfiniteWave маунтится здесь один раз, eager expandQueue не возвращать.
//! Река (RiverBraid) строится по якорям секций — offsetTop + ResizeObserver.

import React, {useCallback, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Sparkles} from '../../../lib/icons';
import type {RiverSectionId} from '../../../lib/layout';
import {isUrnLiked, likedTracksCount, useLiked} from '../../../lib/likes';
import {useMomentsTeaser} from '../../../lib/moments/teaser';
import {useAuthStore} from '../../../stores/auth';
import type {Track} from '../../../stores/player';
import {usePlayerStore} from '../../../stores/player';
import {useSettingsStore} from '../../../stores/settings';
import {
  ClusterEmptyState,
  type ClusterHydrated,
  type ClusterId,
  ClusterRow,
  ClusterSkeletonState,
  NeighborsRow,
  useClusterWave,
  waveQueue,
} from '../../music/cluster';
import {useInfiniteWave} from '../../music/soundwave/use-infinite-wave';
import {ArtistWire} from './ArtistWire';
import {EstuaryDeck} from './EstuaryDeck';
import {MomentsStation} from './MomentsStation';
import {type AnchorKind, type AnchorMap, RiverBraid} from './RiverBraid';
import {RiverSection} from './RiverSection';
import {DeepShelf, ReleaseBrook, VibeShelf} from './stations';
import {WaveSchedule} from './WaveSchedule';

/** Якорные порядки русла: river течёт сверху вниз через эти точки. */
const ANCHOR_ORDER: Record<string, number> = {
  wave: 1,
  moments: 1.5,
  top_artists: 2,
  fresh_drops: 3,
  same_vibe: 4,
  adjacent: 5,
  deep_cuts: 6,
  discover: 7,
  delta: 9,
};

/** Дельта — эпилог: течение продолжается, очередь доливается сама. */
function DeltaNote() {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-dashed border-ink/[0.1] px-5 py-6 text-center">
      <p className="font-mono text-[12px] tracking-[0.04em] text-ink-40">
        ∞ · {t('soundwave.river.deltaNote')}
      </p>
    </div>
  );
}

export const RiverFlow = React.memo(function RiverFlow({ tint }: { tint?: string[] }) {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const likesCount = useAuthStore((s) => likedTracksCount(s.user) ?? 0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const anchorsRef = useRef<AnchorMap>(new Map());
  const selectedLanguages = useSettingsStore((s) => s.soundwaveLanguages);
  const setSelectedLanguages = useSettingsStore((s) => s.setSoundwaveLanguages);
  const selectedGenres = useSettingsStore((s) => s.soundwaveGenres);
  const setSelectedGenres = useSettingsStore((s) => s.setSoundwaveGenres);
  const hideLiked = useSettingsStore((s) => s.soundwaveHideLiked);
  const setHideLiked = useSettingsStore((s) => s.setSoundwaveHideLiked);
  const hideListened = useSettingsStore((s) => s.soundwaveHideListened);
  const setHideListened = useSettingsStore((s) => s.setSoundwaveHideListened);
  const riverHidden = useSettingsStore((s) => s.riverHidden);
  const momentsTracks = useMomentsTeaser(isAuthenticated && !riverHidden.includes('moments'));
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const stableLanguages = useMemo(() => [...selectedLanguages].sort(), [selectedLanguages]);
  const langKey = stableLanguages.join(',') || 'all';
  const stableGenres = useMemo(() => [...selectedGenres].sort(), [selectedGenres]);
  const genreKey = stableGenres.join(',') || 'any';

  const url = useMemo(() => {
    if (!isAuthenticated) return null;
    const qs = new URLSearchParams();
    if (stableLanguages.length > 0) qs.set('languages', stableLanguages.join(','));
    if (stableGenres.length > 0) qs.set('genres', stableGenres.join(','));
    qs.set('hide_listened', hideListened ? '1' : '0');
    const suffix = qs.toString() ? `?${qs}` : '';
    return `/recommendations${suffix}`;
  }, [isAuthenticated, stableLanguages, stableGenres, hideListened]);

  const { data, isLoading, isError, isFetching, refetch } = useClusterWave({
    queryKey: ['cluster-wave', 'home', langKey, genreKey, hideListened],
    url,
    enabled: isAuthenticated,
  });

  const rawClusters = useMemo(() => data?.clusters ?? [], [data]);

  // Live-тик лайков: hide-liked фильтры пересчитываются, когда лайк текущего
  // трека переключился (основная цель лайка с этой поверхности).
  const likesVersion = useLiked(currentTrack?.urn ?? '');
  const keepTrack = useCallback(
    (tr: Track) => !hideLiked || (!tr.user_favorite && !isUrnLiked(tr.urn)),
    [hideLiked],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: likesVersion ticks the live hide-liked filter.
  const filteredClusters = useMemo(() => {
    return rawClusters
      .map((c) => {
        const trackByUrn = new Map(c.tracks.map((tr) => [tr.urn, tr]));
        return {
          ...c,
          tracks: c.tracks.filter(keepTrack),
          neighbors: c.neighbors?.filter((n) => {
            const matchTrack = trackByUrn.get(n.track_urn);
            return !matchTrack || keepTrack(matchTrack);
          }),
        };
      })
      .filter((c) => c.tracks.length > 0) as ClusterHydrated[];
  }, [rawClusters, keepTrack, likesVersion]);

  const clusterById = useMemo(
    () => new Map(filteredClusters.map((c) => [c.id as ClusterId, c])),
    [filteredClusters],
  );
  const waveCluster = clusterById.get('wave') ?? null;
  const playQueue = useMemo(() => waveQueue(filteredClusters), [filteredClusters]);

  const waveTrack = currentTrack ?? playQueue[0] ?? null;
  const isCurrent = !!currentTrack && waveTrack?.urn === currentTrack.urn;

  useInfiniteWave({
    enabled: isAuthenticated,
    seedKind: 'user',
    initialTracks: waveCluster?.tracks ?? [],
    initialCursor: waveCluster?.cursor ?? null,
    languages: stableLanguages,
    filterTrack: keepTrack,
    hideListened,
  });

  if (!isAuthenticated) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setTimeout(() => setIsRefreshing(false), 350);
    }
  };

  const handlePlayWave = () => {
    if (playQueue.length === 0) return;
    usePlayerStore.getState().play(playQueue[0], playQueue);
  };

  const showCold = !isLoading && filteredClusters.length === 0;
  const coldState = isError
    ? 'error'
    : rawClusters.length > 0
      ? 'allLiked'
      : likesCount > 0
        ? 'building'
        : 'cold';
  const section = (id: Exclude<RiverSectionId, 'moments'>) =>
    riverHidden.includes(id) ? undefined : clusterById.get(id);
  const waveSection = section('wave');
  const showMoments = momentsTracks.length > 0 && !riverHidden.includes('moments');
  const topArtists = section('top_artists');
  const adjacent = section('adjacent');
  const freshDrops = section('fresh_drops');
  const sameVibe = section('same_vibe');
  const deepCuts = section('deep_cuts');
  const discover = section('discover');

  const anchorRef = (id: string, kind: AnchorKind) => (el: HTMLElement | null) => {
    if (el) anchorsRef.current.set(id, { el, kind, order: ANCHOR_ORDER[id] ?? 8 });
    else anchorsRef.current.delete(id);
  };
  // Отпечаток состава секций: смена набора кластеров перестраивает путь реки.
  const layoutKey = [waveSection, showMoments, topArtists, freshDrops, sameVibe, adjacent, deepCuts, discover]
    .map((c) => (c ? '1' : '0'))
    .join('');

  const sectionTitle = (id: string) => t(`soundwave.home.cluster.${id}`);
  const sectionWhy = (id: string) => t(`soundwave.home.cluster.${id}Desc`);

  const artistsBody = (cluster: ClusterHydrated) =>
    cluster.neighbors?.length ? (
      <ArtistWire cluster={cluster} />
    ) : (
      <ClusterRow
        hideHeader
        clusterId={cluster.id}
        title=""
        description=""
        icon={null}
        index={0}
        tracks={cluster.tracks}
        queue={cluster.tracks}
      />
    );

  return (
    <div>
      <EstuaryDeck
        track={waveTrack}
        queue={playQueue.length > 0 ? playQueue : waveTrack ? [waveTrack] : []}
        isCurrent={isCurrent}
        hideListened={hideListened}
        onHideListened={setHideListened}
        hideLiked={hideLiked}
        onHideLiked={setHideLiked}
        languages={selectedLanguages}
        onLanguages={setSelectedLanguages}
        genres={selectedGenres}
        onGenres={setSelectedGenres}
        spinning={isRefreshing || isFetching}
        onRefresh={() => void handleRefresh()}
        onPlayWave={handlePlayWave}
        canPlay={playQueue.length > 0}
      />

      {isLoading ? (
        <div className="pt-10">
          <ClusterSkeletonState rows={3} itemsPerRow={6} />
        </div>
      ) : showCold ? (
        <div className="pt-10">
          <ClusterEmptyState
            icon={<Sparkles size={20} style={{ color: 'var(--color-accent)' }} />}
            title={t(`soundwave.${coldState}Title`)}
            description={t(`soundwave.${coldState}Desc`)}
            cta={isError ? t('common.retry') : undefined}
            onAction={() => void refetch()}
          />
        </div>
      ) : (
        <div ref={wrapRef} className="relative mt-12">
          <RiverBraid rootRef={wrapRef} anchorsRef={anchorsRef} tint={tint} layoutKey={layoutKey} />
          <div className="relative z-10 flex flex-col gap-12">
            {waveSection && (
              <div ref={anchorRef('wave', 'node')}>
                <RiverSection title={sectionTitle('wave')} why={sectionWhy('wave')}>
                  <WaveSchedule tracks={waveSection.tracks} />
                </RiverSection>
              </div>
            )}

            {showMoments && (
              <div ref={anchorRef('moments', 'node')}>
                <RiverSection title={sectionTitle('moments')} why={sectionWhy('moments')}>
                  <MomentsStation tracks={momentsTracks} />
                </RiverSection>
              </div>
            )}

            {(topArtists || freshDrops) && (
              <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-8">
                {topArtists && (
                  <div ref={anchorRef('top_artists', 'node')} className="min-w-0 lg:col-span-7">
                    <RiverSection
                      title={sectionTitle('top_artists')}
                      why={sectionWhy('top_artists')}
                    >
                      {artistsBody(topArtists)}
                    </RiverSection>
                  </div>
                )}
                {freshDrops && (
                  <div
                    ref={anchorRef('fresh_drops', topArtists ? 'branch' : 'node')}
                    className={`min-w-0 ${topArtists ? 'lg:col-span-5' : 'lg:col-span-12'}`}
                  >
                    <RiverSection
                      title={sectionTitle('fresh_drops')}
                      why={sectionWhy('fresh_drops')}
                      tone="panel"
                    >
                      <ReleaseBrook tracks={freshDrops.tracks} />
                    </RiverSection>
                  </div>
                )}
              </div>
            )}

            {(sameVibe || adjacent) && (
              <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-8">
                {sameVibe && (
                  <div ref={anchorRef('same_vibe', 'node')} className="min-w-0 lg:col-span-7">
                    <RiverSection title={sectionTitle('same_vibe')} why={sectionWhy('same_vibe')}>
                      <VibeShelf tracks={sameVibe.tracks} />
                    </RiverSection>
                  </div>
                )}
                {adjacent && (
                  <div
                    ref={anchorRef('adjacent', sameVibe ? 'branch' : 'node')}
                    className={`min-w-0 ${sameVibe ? 'lg:col-span-5' : 'lg:col-span-12'}`}
                  >
                    <RiverSection
                      title={sectionTitle('adjacent')}
                      why={sectionWhy('adjacent')}
                      tone="panel"
                    >
                      {adjacent.neighbors?.length ? (
                        <NeighborsRow
                          hideHeader
                          title=""
                          description=""
                          icon={null}
                          index={0}
                          cluster={adjacent}
                        />
                      ) : (
                        <ClusterRow
                          hideHeader
                          clusterId={adjacent.id}
                          title=""
                          description=""
                          icon={null}
                          index={0}
                          tracks={adjacent.tracks}
                          queue={adjacent.tracks}
                        />
                      )}
                    </RiverSection>
                  </div>
                )}
              </div>
            )}

            {deepCuts && (
              <div ref={anchorRef('deep_cuts', 'node')}>
                <RiverSection
                  title={sectionTitle('deep_cuts')}
                  why={sectionWhy('deep_cuts')}
                  tone="deep"
                >
                  <DeepShelf tracks={deepCuts.tracks} />
                </RiverSection>
              </div>
            )}

            {discover && (
              <div ref={anchorRef('discover', 'node')}>
                <RiverSection title={sectionTitle('discover')} why={sectionWhy('discover')}>
                  <ClusterRow
                    hideHeader
                    clusterId={discover.id}
                    title=""
                    description=""
                    icon={null}
                    index={0}
                    tracks={discover.tracks}
                    queue={discover.tracks}
                  />
                </RiverSection>
              </div>
            )}

            <div ref={anchorRef('delta', 'delta')}>
              <DeltaNote />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
