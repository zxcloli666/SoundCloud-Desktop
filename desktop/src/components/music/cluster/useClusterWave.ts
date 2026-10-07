import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { trackUrn } from '../../../lib/ids';
import { fetchTracksByUrns } from '../../../lib/soundwave';
import type { Track } from '../../../stores/player';
import type {
  ClusterData,
  ClusterDto,
  ClusterHydrated,
  ClusterId,
  ClusterNeighbor,
  ClusterResponseDto,
} from './types';

const STALE_MS = 30_000;
const GC_MS = 5 * 60_000;

const KNOWN_IDS: ReadonlyArray<ClusterId> = [
  'wave',
  'essence',
  'vibe',
  'neighbors',
  'deep',
  'for_you',
  'top_artists',
  'adjacent',
  'fresh_drops',
  'same_vibe',
  'deep_cuts',
  'same_artist',
  'featured_with',
  'fans_also',
  'discover',
];

export interface UseClusterWaveOptions {
  queryKey: ReadonlyArray<unknown>;
  url: string | null;
  enabled?: boolean;
  staleMs?: number;
  gcMs?: number;
}

export function useClusterWave(opts: UseClusterWaveOptions): UseQueryResult<ClusterData> {
  return useQuery<ClusterData>({
    queryKey: opts.queryKey,
    enabled: opts.enabled !== false && !!opts.url,
    staleTime: opts.staleMs ?? STALE_MS,
    gcTime: opts.gcMs ?? GC_MS,
    retry: false,
    queryFn: () => fetchAndHydrate(opts.url!),
  });
}

export async function fetchAndHydrate(url: string): Promise<ClusterData> {
  const dto = await api<ClusterResponseDto>(url);
  const known = dto.clusters.filter((c): c is ClusterDto & { id: ClusterId } =>
    isKnownClusterId(c.id),
  );
  if (!known.some((c) => c.track_ids.length > 0)) {
    return { clusters: [], allTracks: [] };
  }

  const tracksByCluster = await clusterTracks(known);
  const loaded = new Set(tracksByCluster.flat().map((t) => t.urn));
  if (loaded.size === 0) {
    throw new Error(`no tracks could be loaded for ${url}`);
  }

  const clusters: ClusterHydrated[] = [];
  known.forEach((cluster, i) => {
    const tracks = tracksByCluster[i];
    if (tracks.length === 0) return;
    const neighbors = (cluster.neighbors ?? []).flatMap((n): ClusterNeighbor[] => {
      const urn = trackUrn(n.track_id);
      return urn && loaded.has(urn) ? [{ ...n, track_urn: urn }] : [];
    });
    const hydrated: ClusterHydrated = { id: cluster.id, tracks };
    if (neighbors.length > 0) hydrated.neighbors = neighbors;
    clusters.push(hydrated);
  });

  const allTracks: Track[] = [];
  const seen = new Set<string>();
  const cursors = clusters.map(() => 0);
  let advanced = true;
  while (advanced) {
    advanced = false;
    for (let ci = 0; ci < clusters.length; ci++) {
      const c = clusters[ci];
      while (cursors[ci] < c.tracks.length) {
        const t = c.tracks[cursors[ci]++];
        if (!seen.has(t.urn)) {
          seen.add(t.urn);
          allTracks.push(t);
          advanced = true;
          break;
        }
      }
    }
  }

  return { clusters, allTracks };
}

function clusterUrns(cluster: ClusterDto): string[] {
  const urns = cluster.track_urns ?? cluster.track_ids.map((id) => trackUrn(id));
  return urns.filter((urn): urn is string => !!urn);
}

async function clusterTracks(clusters: ClusterDto[]): Promise<Track[][]> {
  const legacy = clusters.filter((c) => !c.tracks);
  const fetched = await fetchTracksByUrns(legacy.flatMap(clusterUrns));
  const byUrn = new Map(fetched.map((t) => [t.urn, t]));
  return clusters.map(
    (c) =>
      c.tracks ??
      clusterUrns(c).flatMap((urn) => {
        const track = byUrn.get(urn);
        return track ? [track] : [];
      }),
  );
}

function isKnownClusterId(id: string): id is ClusterId {
  return (KNOWN_IDS as ReadonlyArray<string>).includes(id);
}
