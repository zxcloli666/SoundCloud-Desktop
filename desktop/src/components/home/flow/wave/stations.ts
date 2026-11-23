import { useMemo } from 'react';
import type { StationId } from '../../../../lib/layout';
import { useVisibleBlocks } from '../../../../lib/use-layout';
import type { Track } from '../../../../stores/player';
import { usePlayerStore } from '../../../../stores/player';
import { useSettingsStore } from '../../../../stores/settings';
import {
  type ClusterHydrated,
  type ClusterNeighborDto,
  fetchArtistQueue,
} from '../../../music/cluster';

export type WaveTrouble = 'error' | 'allLiked' | 'building' | 'cold';

export interface WaveFeed {
  tracks: Track[];
  clusters: ReadonlyMap<string, ClusterHydrated>;
  loading: boolean;
  trouble: WaveTrouble | null;
  onRetry: () => void;
}

export interface StationRow {
  track: Track;
  artist?: ClusterNeighborDto;
  start: () => void;
}

export function useStations(feed: WaveFeed): { ids: StationId[]; active: StationId } {
  const enabled = useVisibleBlocks('stations');
  const saved = useSettingsStore((s) => s.homeStation);
  const ids = useMemo(
    () =>
      enabled.filter(
        (id) => id === 'wave' || feed.clusters.has(id) || (feed.loading && id !== 'discover'),
      ),
    [enabled, feed.loading, feed.clusters],
  );
  return { ids, active: ids.includes(saved) ? saved : 'wave' };
}

export function stationRows(id: StationId, feed: WaveFeed): StationRow[] {
  if (id === 'wave') return trackRows(feed.tracks);
  const cluster = feed.clusters.get(id);
  return cluster ? clusterRows(cluster) : [];
}

export function clusterRows(cluster: ClusterHydrated): StationRow[] {
  return cluster.neighbors?.length ? artistRows(cluster) : trackRows(cluster.tracks);
}

function trackRows(tracks: Track[]): StationRow[] {
  return tracks.map((track) => ({
    track,
    start: () => usePlayerStore.getState().play(track, tracks),
  }));
}

function artistRows({ tracks, neighbors = [] }: ClusterHydrated): StationRow[] {
  const byUrn = new Map(tracks.map((track) => [track.urn, track]));
  return neighbors.flatMap((artist) => {
    const track = byUrn.get(artist.track_urn);
    return track ? [{ track, artist, start: () => void playArtist(artist, track) }] : [];
  });
}

async function playArtist(artist: ClusterNeighborDto, track: Track) {
  usePlayerStore.getState().play(track, await fetchArtistQueue(artist.artist_id, track));
}
