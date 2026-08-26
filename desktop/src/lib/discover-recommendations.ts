import type { Track } from '../stores/player';

export const DISCOVER_SEED_LIMIT = 8;

export interface DiscoverRelatedCandidate {
  track: Track;
  /** Sum of reciprocal ranks across distinct seed result lists. */
  evidenceScore: number;
  hitCount: number;
  bestRank: number;
  firstSeen: number;
}

export interface DiscoverRankOptions {
  excludedUrns?: ReadonlySet<string>;
  blockedUrns?: ReadonlySet<string>;
  mode?: 'similar' | 'diverse';
  limit?: number;
}

export interface DiscoverGenreGroup {
  genre: string;
  tracks: Track[];
}

function normalize(value: string | null | undefined): string | null {
  const result = value?.trim().toLowerCase().replace(/\s+/g, ' ');
  return result || null;
}

function artistKey(track: Track): string {
  return (
    normalize(track.user?.urn) ??
    normalize(track.user?.username) ??
    `unknown:${track.urn}`
  );
}

function genreKey(track: Track): string | null {
  return normalize(track.genre);
}

export function isDiscoverTrackPlayable(track: Track): boolean {
  return Boolean(
    track?.urn &&
      track.access !== 'blocked' &&
      track.sharing !== 'private' &&
      Number.isFinite(track.duration) &&
      track.duration > 0,
  );
}

function uniqueUsableTracks(
  tracks: readonly Track[],
  blockedUrns: ReadonlySet<string>,
): Track[] {
  const result: Track[] = [];
  const seen = new Set<string>();
  for (const track of tracks) {
    if (
      !isDiscoverTrackPlayable(track) ||
      seen.has(track.urn) ||
      blockedUrns.has(track.urn)
    ) {
      continue;
    }
    seen.add(track.urn);
    result.push(track);
  }
  return result;
}

function appendDiverse(
  target: Track[],
  pool: readonly Track[],
  quota: number,
  selectedUrns: Set<string>,
  artists: Set<string>,
  genres: Set<string>,
): void {
  for (let appended = 0; appended < quota; appended++) {
    let best: Track | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < pool.length; index++) {
      const track = pool[index];
      if (selectedUrns.has(track.urn)) continue;
      const artist = artistKey(track);
      const genre = genreKey(track);
      const score =
        (artists.has(artist) ? 0 : 4) +
        (genre && !genres.has(genre) ? 2 : 0) +
        1 / (index + 1);
      if (score > bestScore) {
        best = track;
        bestScore = score;
      }
    }
    if (!best) return;
    target.push(best);
    selectedUrns.add(best.urn);
    artists.add(artistKey(best));
    const genre = genreKey(best);
    if (genre) genres.add(genre);
  }
}

/**
 * Deterministic, bounded seed selection. Two recent tracks establish current
 * intent; the remaining slots cover distinct artists and genres from likes.
 */
export function selectDiscoverSeeds(
  likedTracks: readonly Track[],
  recentTracks: readonly Track[] = [],
  options: { limit?: number; blockedUrns?: ReadonlySet<string> } = {},
): Track[] {
  const requestedLimit = Math.floor(options.limit ?? DISCOVER_SEED_LIMIT);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(0, Math.min(DISCOVER_SEED_LIMIT, requestedLimit))
    : DISCOVER_SEED_LIMIT;
  if (limit === 0) return [];

  const blockedUrns = options.blockedUrns ?? new Set<string>();
  const recent = uniqueUsableTracks(recentTracks, blockedUrns);
  const liked = uniqueUsableTracks(likedTracks, blockedUrns);
  const selected: Track[] = [];
  const selectedUrns = new Set<string>();
  const artists = new Set<string>();
  const genres = new Set<string>();
  const recentQuota = Math.min(recent.length, Math.min(2, limit));

  appendDiverse(selected, recent, recentQuota, selectedUrns, artists, genres);
  appendDiverse(selected, liked, limit - selected.length, selectedUrns, artists, genres);
  if (selected.length < limit) {
    appendDiverse(
      selected,
      [...recent, ...liked],
      limit - selected.length,
      selectedUrns,
      artists,
      genres,
    );
  }
  return selected;
}

function reciprocalRank(rank: number): number {
  return 1 / Math.log2(Math.max(0, rank) + 2);
}

/** Convert related result pages into weighted reciprocal-rank evidence. */
export function aggregateRelatedCandidates(
  pages: ReadonlyArray<readonly Track[]>,
): DiscoverRelatedCandidate[] {
  const candidates = new Map<string, DiscoverRelatedCandidate>();
  let firstSeen = 0;

  for (const page of pages) {
    const seenInPage = new Set<string>();
    for (let rank = 0; rank < page.length; rank++) {
      const track = page[rank];
      if (!track?.urn || seenInPage.has(track.urn)) continue;
      seenInPage.add(track.urn);
      const existing = candidates.get(track.urn);
      if (existing) {
        existing.evidenceScore += reciprocalRank(rank);
        existing.hitCount += 1;
        existing.bestRank = Math.min(existing.bestRank, rank);
      } else {
        candidates.set(track.urn, {
          track,
          evidenceScore: reciprocalRank(rank),
          hitCount: 1,
          bestRank: rank,
          firstSeen: firstSeen++,
        });
      }
    }
  }

  return [...candidates.values()];
}

function popularityConfidence(track: Track): number {
  const plays = Math.max(0, track.playback_count ?? 0);
  if (plays === 0) return 0;
  return Math.min(1, Math.log1p(plays) / Math.log1p(10_000_000)) * 0.08;
}

/** Rank related evidence with a cheap artist/genre-aware greedy pass. */
export function rankDiscoverCandidates(
  candidates: readonly DiscoverRelatedCandidate[],
  options: DiscoverRankOptions = {},
): Track[] {
  const requestedLimit = Math.floor(options.limit ?? 60);
  const limit = Number.isFinite(requestedLimit) ? Math.max(0, requestedLimit) : 60;
  if (limit === 0) return [];
  const mode = options.mode ?? 'similar';
  const excludedUrns = options.excludedUrns ?? new Set<string>();
  const blockedUrns = options.blockedUrns ?? new Set<string>();
  const remaining = candidates
    .filter(
      (candidate) =>
        isDiscoverTrackPlayable(candidate.track) &&
        !excludedUrns.has(candidate.track.urn) &&
        !blockedUrns.has(candidate.track.urn),
    )
    .map((candidate) => ({
      ...candidate,
      baseScore:
        candidate.evidenceScore +
        Math.min(0.28, Math.max(0, candidate.hitCount - 1) * 0.07) +
        popularityConfidence(candidate.track),
      artist: artistKey(candidate.track),
      genre: genreKey(candidate.track),
    }));
  const artists = new Map<string, number>();
  const genres = new Map<string, number>();
  const selected: Track[] = [];
  const artistStep = mode === 'diverse' ? 0.86 : 0.58;
  const genreStep = mode === 'diverse' ? 0.14 : 0.06;

  while (selected.length < limit && remaining.length > 0) {
    let bestIndex = 0;
    let bestUtility = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < remaining.length; index++) {
      const candidate = remaining[index];
      const utility =
        candidate.baseScore -
        (artists.get(candidate.artist) ?? 0) * artistStep -
        (candidate.genre ? (genres.get(candidate.genre) ?? 0) * genreStep : 0);
      if (utility > bestUtility) {
        bestIndex = index;
        bestUtility = utility;
      }
    }

    const [winner] = remaining.splice(bestIndex, 1);
    selected.push(winner.track);
    artists.set(winner.artist, (artists.get(winner.artist) ?? 0) + 1);
    if (winner.genre) genres.set(winner.genre, (genres.get(winner.genre) ?? 0) + 1);
  }

  return selected;
}

function diversifyGenreTracks(tracks: readonly Track[]): Track[] {
  const remaining = tracks.map((track, rank) => ({ track, rank, artist: artistKey(track) }));
  const artistCounts = new Map<string, number>();
  const result: Track[] = [];
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestUtility = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < remaining.length; index++) {
      const candidate = remaining[index];
      const utility = reciprocalRank(candidate.rank) - (artistCounts.get(candidate.artist) ?? 0) * 0.5;
      if (utility > bestUtility) {
        bestIndex = index;
        bestUtility = utility;
      }
    }
    const [winner] = remaining.splice(bestIndex, 1);
    result.push(winner.track);
    artistCounts.set(winner.artist, (artistCounts.get(winner.artist) ?? 0) + 1);
  }
  return result;
}

/**
 * Candidate evidence determines genre order, while liked-genre frequency is a
 * small affinity boost. Adjacent genres are therefore allowed into Discover.
 */
export function buildDiscoverGenreGroups(
  rankedTracks: readonly Track[],
  likedTracks: readonly Track[],
  limit = 7,
): DiscoverGenreGroup[] {
  const likedGenres = new Map<string, number>();
  for (const track of likedTracks) {
    const genre = genreKey(track);
    if (genre) likedGenres.set(genre, (likedGenres.get(genre) ?? 0) + 1);
  }

  const groups = new Map<
    string,
    { genre: string; tracks: Track[]; evidence: number; firstRank: number }
  >();
  for (let rank = 0; rank < rankedTracks.length; rank++) {
    const track = rankedTracks[rank];
    const genre = genreKey(track);
    if (!genre) continue;
    const existing = groups.get(genre);
    if (existing) {
      existing.tracks.push(track);
      existing.evidence += reciprocalRank(rank);
    } else {
      groups.set(genre, {
        genre,
        tracks: [track],
        evidence: reciprocalRank(rank),
        firstRank: rank,
      });
    }
  }

  return [...groups.values()]
    .filter((group) => group.tracks.length >= 2)
    .sort((a, b) => {
      const aScore = a.evidence + Math.log1p(likedGenres.get(a.genre) ?? 0) * 0.16;
      const bScore = b.evidence + Math.log1p(likedGenres.get(b.genre) ?? 0) * 0.16;
      return bScore - aScore || a.firstRank - b.firstRank || a.genre.localeCompare(b.genre);
    })
    .slice(0, Math.max(0, limit))
    .map((group) => ({ genre: group.genre, tracks: diversifyGenreTracks(group.tracks) }));
}

/** Preserve the strongest prefix and rotate only the lower-ranked tail. */
export function rotateDiscoverRanking(
  tracks: readonly Track[],
  nonce: number,
  limit = 24,
  pinned = 4,
): Track[] {
  const safeLimit = Math.max(0, Math.floor(limit));
  if (safeLimit === 0) return [];
  if (nonce <= 0 || tracks.length <= pinned) return tracks.slice(0, safeLimit);
  const headSize = Math.min(Math.max(0, pinned), tracks.length);
  const head = tracks.slice(0, headSize);
  const tail = tracks.slice(headSize);
  if (tail.length === 0) return head.slice(0, safeLimit);
  const stride = Math.max(1, Math.floor(tail.length / 3) + 1);
  const offset = ((Math.floor(nonce) * stride) % tail.length + tail.length) % tail.length;
  const rotated = [...tail.slice(offset), ...tail.slice(0, offset)];
  return [...head, ...rotated].slice(0, safeLimit);
}
