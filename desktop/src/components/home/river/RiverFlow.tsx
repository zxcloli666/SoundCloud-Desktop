import React, { useCallback, useMemo, useState } from 'react';
import { isTrackLiked, likedTracksCount, useLiked } from '../../../lib/likes';
import { useAuthStore } from '../../../stores/auth';
import type { Track } from '../../../stores/player';
import { usePlayerStore } from '../../../stores/player';
import { useSettingsStore } from '../../../stores/settings';
import {
  type ClusterHydrated,
  homeWaveQuery,
  keepVisible,
  useClusterWave,
  waveQueue,
} from '../../music/cluster';
import { useInfiniteWave } from '../../music/soundwave/use-infinite-wave';
import { FlowDeck } from '../flow/FlowDeck';
import type { WaveFeed, WaveTrouble } from '../flow/wave/stations';

const WAVE_CARDS = 5;
const NO_TRACKS: Track[] = [];

export const RiverFlow = React.memo(function RiverFlow() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const likesCount = useAuthStore((s) => likedTracksCount(s.user) ?? 0);
  const languages = useSettingsStore((s) => s.soundwaveLanguages);
  const genres = useSettingsStore((s) => s.soundwaveGenres);
  const hideLiked = useSettingsStore((s) => s.soundwaveHideLiked);
  const hideListened = useSettingsStore((s) => s.soundwaveHideListened);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const [refreshing, setRefreshing] = useState(false);
  const [liveWave, setLiveWave] = useState<Track[]>(NO_TRACKS);

  const stableLanguages = useMemo(() => [...languages].sort(), [languages]);

  const { data, isLoading, isError, isFetching, refetch } = useClusterWave({
    ...homeWaveQuery({ languages, genres, hideListened }),
    enabled: isAuthenticated,
  });

  const rawClusters = useMemo(() => data?.clusters ?? [], [data]);

  const likesVersion = useLiked(currentTrack?.urn ?? '');
  const keepTrack = useCallback((track: Track) => !hideLiked || !isTrackLiked(track), [hideLiked]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: likesVersion ticks the live hide-liked filter.
  const clusters = useMemo(
    () => keepVisible({ clusters: rawClusters }, keepTrack).clusters,
    [rawClusters, keepTrack, likesVersion],
  );

  const clusterById = useMemo(
    () => new Map<string, ClusterHydrated>(clusters.map((cluster) => [cluster.id, cluster])),
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

  const empty = !isLoading && clusters.length === 0;
  const trouble = empty
    ? troubleOf(isError || !data, rawClusters.length > 0, likesCount > 0)
    : null;
  const feed = useMemo<WaveFeed>(
    () => ({
      tracks: shownWave,
      clusters: clusterById,
      loading: isLoading,
      trouble,
      onRetry: () => void refetch(),
    }),
    [shownWave, clusterById, isLoading, trouble, refetch],
  );

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

  return (
    <FlowDeck
      feed={feed}
      canPlay={playQueue.length > 0}
      onPlayWave={playWave}
      spinning={refreshing || isFetching}
      onRefresh={() => void refresh()}
    />
  );
});

function troubleOf(failed: boolean, filteredOut: boolean, hasLikes: boolean): WaveTrouble {
  if (failed) return 'error';
  if (filteredOut) return 'allLiked';
  return hasLikes ? 'building' : 'cold';
}
