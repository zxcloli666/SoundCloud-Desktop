import type {
  ClusterCandidate,
  ClusterCandidateSource,
  ClusterId,
} from '../components/music/cluster/types';
import type { Track } from '../stores/player';
import { decayRecommendationScore } from './recommendation-score';

export type HomeRecommendationMode = 'similar' | 'diverse';
export type HomeRecommendationInput = Track | ClusterCandidate;

export interface HomeRecommendationFeedback {
  tracks?: Readonly<
    Record<
      string,
      {
        score: number;
        updatedAt: number;
        artistUrn?: string;
        genre?: string;
      }
    >
  >;
  clusters?: Readonly<Record<string, { score: number; updatedAt: number }>>;
}

export interface HomeRecommendationOptions {
  /** Familiar tracks receive a soft penalty and remain available as a cold fallback. */
  excludedUrns?: ReadonlySet<string>;
  /** Dislikes and policy blocks are never admitted. */
  blockedUrns?: ReadonlySet<string>;
  likedTracks?: readonly Track[];
  recentTracks?: readonly Track[];
  mode?: HomeRecommendationMode;
  feedback?: HomeRecommendationFeedback;
  /** Session impressions softly rotate an otherwise identical server response. */
  exposureCounts?: ReadonlyMap<string, number>;
  /** Explicit refresh epoch rotates the strongest shelf without adding randomness. */
  rotationEpoch?: number;
  /** Prevents a score change and the explicit rotation from cancelling each other out. */
  previousTopUrn?: string;
  limit?: number;
  /** Stable clock injection for deterministic tests and long-lived memoized views. */
  now?: number;
}

interface TasteProfile {
  artists: Map<string, number>;
  genres: Map<string, number>;
  tags: Map<string, number>;
  likedUrns: Set<string>;
  recentUrns: Set<string>;
}

interface RankedCandidate {
  track: Track;
  sources: ClusterCandidateSource[];
  inputIndex: number;
  baseScore: number;
  artist: string;
  genre: string | null;
}

const CLUSTER_PRIORS: Record<ClusterId, Record<HomeRecommendationMode, number>> = {
  for_you: { similar: 1.16, diverse: 1.02 },
  wave: { similar: 1.13, diverse: 1.04 },
  essence: { similar: 1.1, diverse: 0.98 },
  vibe: { similar: 1.04, diverse: 1.01 },
  top_artists: { similar: 1.02, diverse: 0.88 },
  same_vibe: { similar: 1, diverse: 1.02 },
  same_artist: { similar: 0.98, diverse: 0.72 },
  fresh_drops: { similar: 0.94, diverse: 1.1 },
  adjacent: { similar: 0.9, diverse: 1.13 },
  neighbors: { similar: 0.88, diverse: 1.1 },
  featured_with: { similar: 0.88, diverse: 1.06 },
  fans_also: { similar: 0.86, diverse: 1.08 },
  deep: { similar: 0.82, diverse: 1.04 },
  deep_cuts: { similar: 0.8, diverse: 1.06 },
};

function isClusterCandidate(input: HomeRecommendationInput): input is ClusterCandidate {
  return 'track' in input && Array.isArray(input.sources);
}

function artistKey(track: Track): string {
  const urn = track.user?.urn?.trim();
  if (urn) return urn;
  const username = track.user?.username?.trim().toLowerCase();
  return username || `unknown:${track.urn}`;
}

function normalizeLabel(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, ' ');
  return normalized || null;
}

function genreKey(track: Track): string | null {
  return normalizeLabel(track.genre);
}

function tagKeys(track: Track): string[] {
  if (!track.tag_list) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of track.tag_list.split(/[;,|/#]+|\s{2,}/)) {
    const tag = normalizeLabel(part.replace(/^['"]|['"]$/g, ''));
    if (!tag || tag.length < 2 || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= 12) break;
  }
  return tags;
}

function addWeight(map: Map<string, number>, key: string | null, weight: number): void {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + weight);
}

function normalizeWeights(map: Map<string, number>): void {
  let max = 0;
  for (const value of map.values()) max = Math.max(max, value);
  if (max <= 0) return;
  for (const [key, value] of map) map.set(key, value / max);
}

function buildTasteProfile(options: HomeRecommendationOptions): TasteProfile {
  const artists = new Map<string, number>();
  const genres = new Map<string, number>();
  const tags = new Map<string, number>();
  const likedUrns = new Set<string>();
  const recentUrns = new Set<string>();

  const append = (tracks: readonly Track[], kind: 'liked' | 'recent') => {
    const base = kind === 'liked' ? 1 : 0.58;
    const urns = kind === 'liked' ? likedUrns : recentUrns;
    for (let index = 0; index < tracks.length; index++) {
      const track = tracks[index];
      if (!track?.urn) continue;
      urns.add(track.urn);
      const decay = 1 / (1 + index / 24);
      const weight = base * decay;
      addWeight(artists, artistKey(track), weight);
      addWeight(genres, genreKey(track), weight * 0.9);
      for (const tag of tagKeys(track)) addWeight(tags, tag, weight * 0.22);
    }
  };

  append(options.likedTracks ?? [], 'liked');
  append(options.recentTracks ?? [], 'recent');
  const now = options.now ?? Date.now();
  for (const signal of Object.values(options.feedback?.tracks ?? {})) {
    if (!Number.isFinite(signal.score) || !Number.isFinite(signal.updatedAt)) continue;
    const decayedScore = decayRecommendationScore(signal.score, signal.updatedAt, now);
    addWeight(artists, normalizeLabel(signal.artistUrn), decayedScore * 0.24);
    addWeight(genres, normalizeLabel(signal.genre), decayedScore * 0.2);
  }
  normalizeWeights(artists);
  normalizeWeights(genres);
  normalizeWeights(tags);

  return { artists, genres, tags, likedUrns, recentUrns };
}

function reciprocalRank(rank: number): number {
  const safeRank = Number.isFinite(rank) ? Math.max(0, rank) : 0;
  return 1 / Math.log2(safeRank + 2);
}

function scoreSources(sources: ClusterCandidateSource[], mode: HomeRecommendationMode): number {
  if (sources.length === 0) return 0;
  const values = sources
    .map((source) => {
      const prior = CLUSTER_PRIORS[source.clusterId]?.[mode] ?? 0.8;
      const modelBonus = Number.isFinite(source.score) ? Math.tanh(source.score ?? 0) * 0.08 : 0;
      return prior * reciprocalRank(source.rank) + modelBonus;
    })
    .sort((a, b) => b - a);

  let result = values[0];
  for (let index = 1; index < values.length; index++) {
    result += values[index] * 0.16;
  }
  return result + Math.min(0.32, (values.length - 1) * 0.1);
}

function trackFreshness(track: Track, now: number): number {
  const rawDate = track.release_date ?? track.enrichment?.release_date ?? track.created_at;
  if (!rawDate) return 0;
  const timestamp = Date.parse(rawDate);
  if (!Number.isFinite(timestamp)) return 0;
  const ageDays = Math.max(0, (now - timestamp) / 86_400_000);
  if (ageDays >= 365) return 0;
  return (1 - ageDays / 365) * 0.12;
}

function popularityConfidence(track: Track): number {
  const plays = Math.max(0, track.playback_count ?? 0);
  if (plays === 0) return 0;
  return Math.min(1, Math.log1p(plays) / Math.log1p(10_000_000)) * 0.07;
}

function tagAffinity(track: Track, profile: TasteProfile): number {
  let best = 0;
  for (const tag of tagKeys(track)) best = Math.max(best, profile.tags.get(tag) ?? 0);
  return best;
}

export function isRecommendationTrackPlayable(track: Track): boolean {
  return !(
    track.access === 'blocked' ||
    track.sharing === 'private' ||
    !Number.isFinite(track.duration) ||
    track.duration <= 0
  );
}

function familiarPenalty(
  track: Track,
  options: HomeRecommendationOptions,
  profile: TasteProfile,
): number {
  let penalty = 0;
  if (options.excludedUrns?.has(track.urn)) penalty = Math.max(penalty, 0.82);
  if (track.user_favorite || profile.likedUrns.has(track.urn)) penalty = Math.max(penalty, 0.88);
  if (profile.recentUrns.has(track.urn)) penalty = Math.max(penalty, 0.72);
  return penalty;
}

function mergeInputs(inputs: readonly HomeRecommendationInput[]): RankedCandidate[] {
  const merged = new Map<string, RankedCandidate>();
  for (let inputIndex = 0; inputIndex < inputs.length; inputIndex++) {
    const input = inputs[inputIndex];
    const track = isClusterCandidate(input) ? input.track : input;
    if (!track?.urn) continue;
    const sources = isClusterCandidate(input) ? input.sources : [];
    const existing = merged.get(track.urn);
    if (!existing) {
      merged.set(track.urn, {
        track,
        sources: sources.map((source) => ({ ...source })),
        inputIndex,
        baseScore: 0,
        artist: artistKey(track),
        genre: genreKey(track),
      });
      continue;
    }

    for (const source of sources) {
      const previous = existing.sources.find((item) => item.clusterId === source.clusterId);
      if (!previous) existing.sources.push({ ...source });
      else if (source.rank < previous.rank) {
        previous.rank = source.rank;
        previous.score = source.score;
      } else if (previous.score === undefined && source.score !== undefined) {
        previous.score = source.score;
      }
    }
  }
  return [...merged.values()];
}

function baseScore(
  candidate: RankedCandidate,
  options: HomeRecommendationOptions,
  profile: TasteProfile,
  mode: HomeRecommendationMode,
  now: number,
): number {
  const serverScore = candidate.sources.length
    ? scoreSources(candidate.sources, mode)
    : reciprocalRank(candidate.inputIndex);
  const artistAffinity = profile.artists.get(candidate.artist) ?? 0;
  const genreAffinity = candidate.genre ? (profile.genres.get(candidate.genre) ?? 0) : 0;
  const tags = tagAffinity(candidate.track, profile);
  const tasteWeight = mode === 'similar' ? 1 : 0.62;
  const taste = (artistAffinity * 0.52 + genreAffinity * 0.34 + tags * 0.14) * tasteWeight;
  const exploration =
    mode === 'diverse' && artistAffinity === 0 && (genreAffinity > 0 || tags > 0) ? 0.12 : 0;
  const directSignal = options.feedback?.tracks?.[candidate.track.urn];
  const directFeedback = directSignal
    ? decayRecommendationScore(directSignal.score, directSignal.updatedAt, now)
    : 0;
  let clusterFeedback: number | null = null;
  for (const source of candidate.sources) {
    const signal = options.feedback?.clusters?.[source.clusterId];
    if (!signal) continue;
    const value = decayRecommendationScore(signal.score, signal.updatedAt, now);
    clusterFeedback = clusterFeedback === null ? value : Math.max(clusterFeedback, value);
  }

  return (
    serverScore +
    taste +
    exploration +
    trackFreshness(candidate.track, now) +
    popularityConfidence(candidate.track) -
    familiarPenalty(candidate.track, options, profile) -
    Math.min(0.72, (options.exposureCounts?.get(candidate.track.urn) ?? 0) * 0.18) +
    Math.max(-0.8, Math.min(0.5, directFeedback * 0.1)) +
    Math.max(-0.25, Math.min(0.3, (clusterFeedback ?? 0) * 0.04))
  );
}

function diversityPenalty(
  candidate: RankedCandidate,
  artistCounts: ReadonlyMap<string, number>,
  genreCounts: ReadonlyMap<string, number>,
  mode: HomeRecommendationMode,
): number {
  const artistCount = artistCounts.get(candidate.artist) ?? 0;
  const genreCount = candidate.genre ? (genreCounts.get(candidate.genre) ?? 0) : 0;
  const artistStep = mode === 'diverse' ? 0.56 : 0.3;
  const genreStep = mode === 'diverse' ? 0.16 : 0.07;
  return artistCount * artistStep + genreCount * genreStep;
}

/**
 * Cheap deterministic metadata reranker. Server similarity remains the main
 * signal; local taste and an MMR-style greedy pass improve relevance while
 * preventing a visible shelf from collapsing into one artist or genre.
 */
export function curateHomeRecommendations(
  inputs: readonly HomeRecommendationInput[],
  options: HomeRecommendationOptions = {},
): Track[] {
  const limit = Math.max(0, Math.floor(options.limit ?? 20));
  if (limit === 0) return [];

  const mode = options.mode ?? 'similar';
  const profile = buildTasteProfile(options);
  const now = options.now ?? Date.now();
  const remaining = mergeInputs(inputs).filter(
    (candidate) =>
      !options.blockedUrns?.has(candidate.track.urn) &&
      isRecommendationTrackPlayable(candidate.track),
  );

  for (const candidate of remaining) {
    candidate.baseScore = baseScore(candidate, options, profile, mode, now);
  }

  const selected: Track[] = [];
  const artistCounts = new Map<string, number>();
  const genreCounts = new Map<string, number>();

  while (selected.length < limit && remaining.length > 0) {
    let bestIndex = 0;
    let bestUtility = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < remaining.length; index++) {
      const candidate = remaining[index];
      const utility =
        candidate.baseScore - diversityPenalty(candidate, artistCounts, genreCounts, mode);
      // Strict comparison intentionally keeps input order as the stable tie-breaker.
      if (utility > bestUtility) {
        bestIndex = index;
        bestUtility = utility;
      }
    }

    const [winner] = remaining.splice(bestIndex, 1);
    selected.push(winner.track);
    artistCounts.set(winner.artist, (artistCounts.get(winner.artist) ?? 0) + 1);
    if (winner.genre) genreCounts.set(winner.genre, (genreCounts.get(winner.genre) ?? 0) + 1);
  }

  const rotationWindow = Math.min(6, selected.length);
  const rotationOffset =
    rotationWindow > 1 ? Math.abs(Math.floor(options.rotationEpoch ?? 0)) % rotationWindow : 0;
  const rotated =
    rotationOffset === 0
      ? selected
      : [
          ...selected.slice(rotationOffset, rotationWindow),
          ...selected.slice(0, rotationOffset),
          ...selected.slice(rotationWindow),
        ];

  if (
    options.rotationEpoch &&
    rotated.length > 1 &&
    rotated[0].urn === options.previousTopUrn
  ) {
    return [rotated[1], rotated[0], ...rotated.slice(2)];
  }
  return rotated;
}
