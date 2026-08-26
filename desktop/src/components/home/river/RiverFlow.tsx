//! Шелл «Течения»: данные волны (кластеры + бесконечный рефилл очереди) и
//! композиция русла с притоками вдоль реки. Контракты не трогать:
//! useInfiniteWave маунтится здесь один раз, eager expandQueue не возвращать.
//! Река (RiverBraid) строится по якорям секций — offsetTop + ResizeObserver.

import React, {useCallback, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {api} from '../../../lib/api';
import {isUrnDisliked, useDislikeVersion} from '../../../lib/dislikes';
import {isRecommendationTrackPlayable} from '../../../lib/home-recommendations';
import {Sparkles} from '../../../lib/icons';
import {isUrnLiked, useLiked} from '../../../lib/likes';
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
} from '../../music/cluster';
import {useInfiniteWave} from '../../music/soundwave/use-infinite-wave';
import {ArtistWire} from './ArtistWire';
import {EstuaryDeck} from './EstuaryDeck';
import {type AnchorKind, type AnchorMap, RiverBraid} from './RiverBraid';
import {RiverSection} from './RiverSection';
import {DeepShelf, ReleaseBrook, VibeShelf} from './stations';
import {WaveSchedule} from './WaveSchedule';

/** Якорные порядки русла: river течёт сверху вниз через эти точки. */
const ANCHOR_ORDER: Record<string, number> = {
  wave: 1,
  top_artists: 2,
  fresh_drops: 3,
  same_vibe: 4,
  adjacent: 5,
  deep_cuts: 6,
  delta: 9,
};

/** Дельта — эпилог: течение продолжается, очередь доливается сама. */
function DeltaNote() {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.1] px-5 py-6 text-center">
      <p className="font-mono text-[12px] tracking-[0.04em] text-white/40">
        ∞ · {t('soundwave.river.deltaNote')}
      </p>
    </div>
  );
}

export const RiverFlow = React.memo(function RiverFlow({ tint }: { tint?: string[] }) {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const wrapRef = useRef<HTMLDivElement>(null);
  const anchorsRef = useRef<AnchorMap>(new Map());
  const selectedLanguages = useSettingsStore((s) => s.soundwaveLanguages);
  const setSelectedLanguages = useSettingsStore((s) => s.setSoundwaveLanguages);
  const hideLiked = useSettingsStore((s) => s.soundwaveHideLiked);
  const setHideLiked = useSettingsStore((s) => s.setSoundwaveHideLiked);
  const hideListened = useSettingsStore((s) => s.soundwaveHideListened);
  const setHideListened = useSettingsStore((s) => s.setSoundwaveHideListened);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dislikeVersion = useDislikeVersion();

  const stableLanguages = useMemo(() => [...selectedLanguages].sort(), [selectedLanguages]);
  const langKey = stableLanguages.join(',') || 'all';

  const url = useMemo(() => {
    if (!isAuthenticated) return null;
    const qs = new URLSearchParams();
    if (stableLanguages.length > 0) qs.set('languages', stableLanguages.join(','));
    qs.set('hide_listened', hideListened ? '1' : '0');
    const suffix = qs.toString() ? `?${qs}` : '';
    return `/recommendations${suffix}`;
  }, [isAuthenticated, stableLanguages, hideListened]);

  const { data, isLoading, isFetching, refetch } = useClusterWave({
    queryKey: ['cluster-wave', 'home', langKey, hideListened],
    url,
    enabled: isAuthenticated,
  });

  const rawClusters = useMemo(() => data?.clusters ?? [], [data]);
  const rawAllTracks = useMemo(() => data?.allTracks ?? [], [data]);

  // Live-тик лайков: hide-liked фильтры пересчитываются, когда лайк текущего
  // трека переключился (основная цель лайка с этой поверхности).
  const likesVersion = useLiked(currentTrack?.urn ?? '');
  const hideLikedFilter = useCallback((tr: Track) => !tr.user_favorite && !isUrnLiked(tr.urn), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: likesVersion тикает живой isUrnLiked.
  const filteredAllTracks = useMemo(() => {
    void dislikeVersion;
    return rawAllTracks.filter(
      (track) =>
        !isUrnDisliked(track.urn) &&
        isRecommendationTrackPlayable(track) &&
        (!hideLiked || (!track.user_favorite && !isUrnLiked(track.urn))),
    );
  }, [rawAllTracks, hideLiked, likesVersion, dislikeVersion]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: likesVersion тикает живой isUrnLiked.
  const filteredClusters = useMemo(() => {
    void dislikeVersion;
    return rawClusters
      .map((c) => {
        const trackById = new Map<string, Track>();
        for (const tr of c.tracks) {
          const id = tr.urn.split(':').pop();
          if (id) trackById.set(id, tr);
        }
        return {
          ...c,
          tracks: c.tracks.filter(
            (track) =>
              !isUrnDisliked(track.urn) &&
              isRecommendationTrackPlayable(track) &&
              (!hideLiked || (!track.user_favorite && !isUrnLiked(track.urn))),
          ),
          neighbors: c.neighbors?.filter((n) => {
            const matchTrack = trackById.get(String(n.track_id));
            if (!matchTrack) return true;
            return (
              !isUrnDisliked(matchTrack.urn) &&
              isRecommendationTrackPlayable(matchTrack) &&
              (!hideLiked || (!matchTrack.user_favorite && !isUrnLiked(matchTrack.urn)))
            );
          }),
        };
      })
      .filter((c) => c.tracks.length > 0) as ClusterHydrated[];
  }, [rawClusters, hideLiked, likesVersion, dislikeVersion]);

  const clusterById = useMemo(
    () => new Map(filteredClusters.map((c) => [c.id as ClusterId, c])),
    [filteredClusters],
  );
  const waveCluster = clusterById.get('wave') ?? null;

  const waveTrack = currentTrack ?? filteredAllTracks[0] ?? null;
  const isCurrent = !!currentTrack && waveTrack?.urn === currentTrack.urn;

  useInfiniteWave({
    enabled: isAuthenticated,
    seedKind: 'user',
    initialTracks: waveCluster?.tracks ?? [],
    initialCursor: null,
    languages: stableLanguages,
    filterTrack: hideLiked ? hideLikedFilter : undefined,
    hideListened,
  });

  // Клик по артисту → очередь из его лучших треков (sort=popular).
  const neighborArtistByTrack = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of filteredClusters) {
      if (!c.neighbors) continue;
      for (const n of c.neighbors) m.set(String(n.track_id), n.artist_id);
    }
    return m;
  }, [filteredClusters]);
  const neighborMapRef = useRef(neighborArtistByTrack);
  neighborMapRef.current = neighborArtistByTrack;

  const resolveArtistQueue = useCallback(async (track: Track): Promise<Track[]> => {
    const trackId = track.urn.split(':').pop();
    const artistId = trackId ? neighborMapRef.current.get(trackId) : undefined;
    if (!artistId) return [track];
    try {
      const res = await api<{ collection: Track[] }>(
        `/artists/${encodeURIComponent(artistId)}/tracks?role=primary&sort=popular&limit=60`,
      );
      const seen = new Set<string>([track.urn]);
      const ordered: Track[] = [track];
      for (const tr of res.collection ?? []) {
        if (!seen.has(tr.urn)) {
          seen.add(tr.urn);
          ordered.push(tr);
        }
      }
      return ordered;
    } catch {
      return [track];
    }
  }, []);

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
    if (!filteredAllTracks.length) return;
    usePlayerStore.getState().play(filteredAllTracks[0], filteredAllTracks);
  };

  const showCold = !isLoading && filteredClusters.length === 0;
  const topArtists = clusterById.get('top_artists');
  const adjacent = clusterById.get('adjacent');
  const freshDrops = clusterById.get('fresh_drops');
  const sameVibe = clusterById.get('same_vibe');
  const deepCuts = clusterById.get('deep_cuts');

  const anchorRef = (id: string, kind: AnchorKind) => (el: HTMLElement | null) => {
    if (el) anchorsRef.current.set(id, { el, kind, order: ANCHOR_ORDER[id] ?? 8 });
    else anchorsRef.current.delete(id);
  };
  // Отпечаток состава секций: смена набора кластеров перестраивает путь реки.
  const layoutKey = [waveCluster, topArtists, freshDrops, sameVibe, adjacent, deepCuts]
    .map((c) => (c ? '1' : '0'))
    .join('');

  const sectionTitle = (id: string) => t(`soundwave.home.cluster.${id}`);
  const sectionWhy = (id: string) => t(`soundwave.home.cluster.${id}Desc`);

  const artistsBody = (cluster: ClusterHydrated) =>
    cluster.neighbors?.length ? (
      <ArtistWire cluster={cluster} resolveQueue={resolveArtistQueue} />
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
        queue={
          waveCluster?.tracks?.length
            ? waveCluster.tracks
            : filteredAllTracks.length
              ? filteredAllTracks
              : waveTrack
                ? [waveTrack]
                : []
        }
        isCurrent={isCurrent}
        hideListened={hideListened}
        onHideListened={setHideListened}
        hideLiked={hideLiked}
        onHideLiked={setHideLiked}
        languages={selectedLanguages}
        onLanguages={setSelectedLanguages}
        spinning={isRefreshing || isFetching}
        onRefresh={() => void handleRefresh()}
        onPlayWave={handlePlayWave}
        canPlay={filteredAllTracks.length > 0}
      />

      {isLoading ? (
        <div className="pt-10">
          <ClusterSkeletonState rows={3} itemsPerRow={6} />
        </div>
      ) : showCold ? (
        <div className="pt-10">
          <ClusterEmptyState
            icon={<Sparkles size={20} style={{ color: 'var(--color-accent)' }} />}
            title={t('soundwave.coldTitle')}
            description={t('soundwave.coldDesc')}
          />
        </div>
      ) : (
        <div ref={wrapRef} className="relative mt-12">
          <RiverBraid rootRef={wrapRef} anchorsRef={anchorsRef} tint={tint} layoutKey={layoutKey} />
          <div className="relative z-10 flex flex-col gap-12">
            {waveCluster && (
              <div ref={anchorRef('wave', 'node')}>
                <RiverSection title={sectionTitle('wave')} why={sectionWhy('wave')}>
                  <WaveSchedule tracks={waveCluster.tracks} />
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
                          queue={adjacent.tracks}
                          resolveQueue={resolveArtistQueue}
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

            <div ref={anchorRef('delta', 'delta')}>
              <DeltaNote />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
