import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { hydrateByIds, type RecommendResult } from '../../../lib/soundwave';
import type { Track } from '../../../stores/player';
import type {
  ClusterCandidate,
  ClusterCandidateSource,
  ClusterData,
  ClusterDto,
  ClusterHydrated,
  ClusterId,
  ClusterNeighborDto,
  ClusterResponseDto,
  ClusterTrackRefDto,
} from './types';

const STALE_MS = 30_000;
const GC_MS = 5 * 60_000;
const CLUSTER_REQUEST_TIMEOUT_MS = 10_000;
export const MAX_TRACKS_PER_CLUSTER = 10;
export const MAX_HYDRATED_TRACKS = 60;

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

interface NormalizedTrackRef {
  id: string;
  rank: number;
  score?: number;
}

interface NormalizedCluster {
  id: ClusterId;
  refs: NormalizedTrackRef[];
  neighbors?: ClusterNeighborDto[];
}

export interface ClusterHydrationPlan {
  /** Fair round-robin selection across clusters, bounded for metadata hydration. */
  ids: string[];
  clusters: NormalizedCluster[];
  /** Full provenance for selected IDs, not only their top-ten occurrences. */
  sourcesByTrackId: Map<string, ClusterCandidateSource[]>;
}

export async function fetchAndHydrate(url: string, signal?: AbortSignal): Promise<ClusterData> {
  const dto = await api<ClusterResponseDto>(url, { signal }, CLUSTER_REQUEST_TIMEOUT_MS);

  const plan = createClusterHydrationPlan(dto);
  if (plan.ids.length === 0) {
    return { clusters: [], candidates: [], allTracks: [] };
  }

  const fakeRecs: RecommendResult[] = plan.ids.map((id) => ({ id }));
  const hydrated = await hydrateByIds(fakeRecs, signal);

  const byId = new Map<string, Track>();
  for (const t of hydrated) {
    const numericId = t.urn.split(':').pop();
    if (numericId) byId.set(numericId, t);
  }

  const clusters: ClusterHydrated[] = [];
  for (const cluster of plan.clusters) {
    const tracks: Track[] = [];
    for (const ref of cluster.refs.slice(0, MAX_TRACKS_PER_CLUSTER)) {
      const t = byId.get(ref.id);
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

  const candidates: ClusterCandidate[] = plan.ids.flatMap((id) => {
    const track = byId.get(id);
    if (!track) return [];
    return [{ track, sources: plan.sourcesByTrackId.get(id) ?? [] }];
  });

  return { clusters, candidates, allTracks: candidates.map((candidate) => candidate.track) };
}

/**
 * Builds a small metadata-hydration window without flattening away consensus.
 * IDs are selected round-robin so a long first cluster cannot consume the
 * entire budget. Once selected, an ID keeps every occurrence from the full DTO
 * (including a rank beyond ten in another cluster).
 */
export function createClusterHydrationPlan(
  dto: ClusterResponseDto,
  perClusterLimit = MAX_TRACKS_PER_CLUSTER,
  maxIds = MAX_HYDRATED_TRACKS,
): ClusterHydrationPlan {
  const safePerClusterLimit = Math.max(0, Math.floor(perClusterLimit));
  const safeMaxIds = Math.max(0, Math.floor(maxIds));
  const clusters = (Array.isArray(dto?.clusters) ? dto.clusters : [])
    .map(normalizeCluster)
    .filter((cluster): cluster is NormalizedCluster => cluster !== null);

  const ids: string[] = [];
  const selected = new Set<string>();
  if (safePerClusterLimit === 0 || safeMaxIds === 0) {
    return { ids, clusters, sourcesByTrackId: new Map() };
  }
  outer: for (let rank = 0; rank < safePerClusterLimit; rank++) {
    for (const cluster of clusters) {
      const id = cluster.refs[rank]?.id;
      if (!id || selected.has(id)) continue;
      selected.add(id);
      ids.push(id);
      if (ids.length >= safeMaxIds) break outer;
    }
  }

  const sourcesByTrackId = new Map<string, ClusterCandidateSource[]>();
  for (const cluster of clusters) {
    for (const ref of cluster.refs) {
      if (!selected.has(ref.id)) continue;
      const sources = sourcesByTrackId.get(ref.id) ?? [];
      const existing = sources.find((source) => source.clusterId === cluster.id);
      if (!existing) {
        sources.push({ clusterId: cluster.id, rank: ref.rank, score: ref.score });
        sourcesByTrackId.set(ref.id, sources);
      } else if (ref.rank < existing.rank) {
        existing.rank = ref.rank;
        existing.score = ref.score;
      } else if (existing.score === undefined && ref.score !== undefined) {
        existing.score = ref.score;
      }
    }
  }

  return { ids, clusters, sourcesByTrackId };
}

function normalizeCluster(cluster: ClusterDto): NormalizedCluster | null {
  if (!isKnownClusterId(cluster.id)) return null;
  const rawRefs = Array.isArray(cluster.track_ids) ? cluster.track_ids : [];
  const refs: NormalizedTrackRef[] = [];
  const seen = new Set<string>();

  for (let rank = 0; rank < rawRefs.length; rank++) {
    const raw = rawRefs[rank];
    const id = readTrackId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const score = readTrackScore(cluster, raw, id, rank);
    refs.push({ id, rank, score });
  }

  return {
    id: cluster.id,
    refs,
    neighbors: Array.isArray(cluster.neighbors) ? cluster.neighbors : undefined,
  };
}

function readTrackId(ref: string | number | ClusterTrackRefDto): string | null {
  const raw =
    typeof ref === 'object' && ref !== null ? (ref.track_id ?? ref.id) : (ref as string | number);
  if (raw === undefined || raw === null) return null;
  const id = String(raw).trim();
  return id || null;
}

function readTrackScore(
  cluster: ClusterDto,
  ref: string | number | ClusterTrackRefDto,
  id: string,
  rank: number,
): number | undefined {
  const inline = typeof ref === 'object' && ref !== null ? ref.score : undefined;
  const external = Array.isArray(cluster.scores) ? cluster.scores[rank] : cluster.scores?.[id];
  const score = inline ?? external;
  return typeof score === 'number' && Number.isFinite(score) ? score : undefined;
}

function isKnownClusterId(id: string): id is ClusterId {
  return (KNOWN_IDS as ReadonlyArray<string>).includes(id);
}
