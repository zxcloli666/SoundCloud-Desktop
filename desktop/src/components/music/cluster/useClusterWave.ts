import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { hydrateByIds, type RecommendResult } from '../../../lib/soundwave';
import type { Track } from '../../../stores/player';
import type { ClusterData, ClusterHydrated, ClusterId, ClusterResponseDto } from './types';

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
    queryFn: ({ signal }) => fetchAndHydrate(opts.url!, signal),
  });
}

export async function fetchAndHydrate(url: string, signal?: AbortSignal): Promise<ClusterData> {
  const dto = await api<ClusterResponseDto>(url, { signal }).catch((error) => {
    if (signal?.aborted) throw error;
    return { clusters: [] } as ClusterResponseDto;
  });

  const uniqueIds = collectUniqueIds(dto);
  if (uniqueIds.length === 0) {
    return { clusters: [], allTracks: [] };
  }

  const fakeRecs: RecommendResult[] = uniqueIds.map((id) => ({ id }));
  const hydrated = await hydrateByIds(fakeRecs, signal);

  const byId = new Map<string, Track>();
  for (const t of hydrated) {
    const numericId = t.urn.split(':').pop();
    if (numericId) byId.set(numericId, t);
  }

  const clusters: ClusterHydrated[] = [];
  for (const cluster of dto.clusters) {
    if (!isKnownClusterId(cluster.id)) continue;
    const tracks: Track[] = [];
    for (const id of cluster.track_ids) {
      const t = byId.get(String(id));
      if (t) tracks.push(t);
    }
    if (tracks.length === 0) continue;

    if (cluster.neighbors && cluster.neighbors.length > 0) {
      const filteredNeighbors = cluster.neighbors.filter((n) => byId.has(String(n.track_id)));
      if (filteredNeighbors.length > 0) {
        clusters.push({ id: cluster.id, tracks, neighbors: filteredNeighbors });
        continue;
      }
    }
    clusters.push({ id: cluster.id, tracks });
  }

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

function collectUniqueIds(dto: ClusterResponseDto): string[] {
  const set = new Set<string>();
  for (const c of dto.clusters) {
    for (const id of c.track_ids) set.add(String(id));
  }
  return Array.from(set);
}

function isKnownClusterId(id: string): id is ClusterId {
  return (KNOWN_IDS as ReadonlyArray<string>).includes(id);
}
