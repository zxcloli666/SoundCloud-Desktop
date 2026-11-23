import React, { useCallback, useMemo, useState } from 'react';
import { RIVER_SECTIONS, resolveRiverHidden } from '../../../lib/layout';
import { isUrnLiked, likedTracksCount, useLiked } from '../../../lib/likes';
import { useMomentsTeaser } from '../../../lib/moments/teaser';
import { useAuthStore } from '../../../stores/auth';
import type { Track } from '../../../stores/player';
import { usePlayerStore } from '../../../stores/player';
import { useSettingsStore } from '../../../stores/settings';
import {
  type ClusterHydrated,
  type ClusterId,
  useClusterWave,
  waveQueue,
} from '../../music/cluster';
import { useInfiniteWave } from '../../music/soundwave/use-infinite-wave';
import { FlowDeck } from '../flow/FlowDeck';
import { RiverSections } from './RiverSections';

const WAVE_CARDS = 5;
const NO_TRACKS: Track[] = [];

export const RiverFlow = React.memo(function RiverFlow() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const likesCount = useAuthStore((s) => likedTracksCount(s.user) ?? 0);
  const languages = useSettingsStore((s) => s.soundwaveLanguages);
  const genres = useSettingsStore((s) => s.soundwaveGenres);
  const hideLiked = useSettingsStore((s) => s.soundwaveHideLiked);
  const hideListened = useSettingsStore((s) => s.soundwaveHideListened);
  const savedHidden = useSettingsStore((s) => s.riverHidden);
  const hidden = useMemo(() => resolveRiverHidden(savedHidden), [savedHidden]);
  const sectionsShown = RIVER_SECTIONS.some((id) => !hidden.has(id));
  const teaser = useMomentsTeaser(isAuthenticated && !hidden.has('moments'));
  const moments = useMemo(
    () => teaser.filter((track) => Boolean(track.user?.avatar_url)),
    [teaser],
  );
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const [refreshing, setRefreshing] = useState(false);
  const [liveWave, setLiveWave] = useState<Track[]>(NO_TRACKS);

  const stableLanguages = useMemo(() => [...languages].sort(), [languages]);
  const stableGenres = useMemo(() => [...genres].sort(), [genres]);
  const langKey = stableLanguages.join(',') || 'all';
  const genreKey = stableGenres.join(',') || 'any';

  const url = useMemo(() => {
    if (!isAuthenticated) return null;
    const qs = new URLSearchParams();
    if (stableLanguages.length > 0) qs.set('languages', stableLanguages.join(','));
    if (stableGenres.length > 0) qs.set('genres', stableGenres.join(','));
    qs.set('hide_listened', hideListened ? '1' : '0');
    return `/recommendations?${qs}`;
  }, [isAuthenticated, stableLanguages, stableGenres, hideListened]);

  const { data, isLoading, isError, isFetching, refetch } = useClusterWave({
    queryKey: ['cluster-wave', 'home', langKey, genreKey, hideListened],
    url,
    enabled: isAuthenticated,
  });

  const rawClusters = useMemo(() => data?.clusters ?? [], [data]);

  const likesVersion = useLiked(currentTrack?.urn ?? '');
  const keepTrack = useCallback(
    (track: Track) => !hideLiked || (!track.user_favorite && !isUrnLiked(track.urn)),
    [hideLiked],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: likesVersion ticks the live hide-liked filter.
  const clusters = useMemo(() => {
    return rawClusters
      .map((cluster) => {
        const byUrn = new Map(cluster.tracks.map((track) => [track.urn, track]));
        return {
          ...cluster,
          tracks: cluster.tracks.filter(keepTrack),
          neighbors: cluster.neighbors?.filter((n) => {
            const match = byUrn.get(n.track_urn);
            return !match || keepTrack(match);
          }),
        };
      })
      .filter((cluster) => cluster.tracks.length > 0) as ClusterHydrated[];
  }, [rawClusters, keepTrack, likesVersion]);

  const clusterById = useMemo(
    () => new Map(clusters.map((cluster) => [cluster.id as ClusterId, cluster])),
    [clusters],
  );
  const waveCluster = clusterById.get('wave') ?? null;
  const playQueue = useMemo(() => waveQueue(clusters), [clusters]);

  useInfiniteWave({
    enabled: isAuthenticated,
    seedKind: 'user',
    initialTracks: waveCluster?.tracks ?? NO_TRACKS,
    initialCursor: waveCluster?.cursor ?? null,
    languages: stableLanguages,
    filterTrack: keepTrack,
    hideListened,
    batchLimit: 20,
    visibleLimit: WAVE_CARDS,
    onWaveTracksChange: setLiveWave,
  });

  const shownWave = useMemo(() => {
    const source = liveWave.length >= WAVE_CARDS ? liveWave : playQueue;
    return source.slice(0, WAVE_CARDS);
  }, [liveWave, playQueue]);

  if (!isAuthenticated) return null;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setTimeout(() => setRefreshing(false), 350);
    }
  };

  const playWave = () => {
    if (playQueue.length === 0) return;
    usePlayerStore.getState().play(playQueue[0], playQueue);
  };

  const empty = !isLoading && clusters.length === 0;
  const cold = !empty
    ? null
    : isError
      ? 'error'
      : rawClusters.length > 0
        ? 'allLiked'
        : likesCount > 0
          ? 'building'
          : 'cold';

  return (
    <div>
      <FlowDeck
        waveTracks={shownWave}
        canPlay={playQueue.length > 0}
        onPlayWave={playWave}
        spinning={refreshing || isFetching}
        onRefresh={() => void refresh()}
      />
      {sectionsShown && (
        <div className="pt-12">
          <RiverSections
            loading={isLoading}
            cold={cold}
            onRetry={() => void refetch()}
            clusters={clusterById}
            hidden={hidden}
            moments={moments}
          />
        </div>
      )}
    </div>
  );
});
