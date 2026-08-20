import type { Track } from '../stores/player';

export interface HomeRecommendationOptions {
  excludedUrns?: ReadonlySet<string>;
  blockedUrns?: ReadonlySet<string>;
  limit?: number;
}

function artistKey(track: Track): string {
  const urn = track.user.urn.trim();
  if (urn) return urn;
  const username = track.user.username.trim().toLocaleLowerCase();
  return username || `unknown:${track.urn}`;
}

function genreKey(track: Track): string | null {
  const genre = track.genre?.trim().toLocaleLowerCase();
  return genre || null;
}

/**
 * Preserve the server's recommendation order while preventing the first row
 * from collapsing into one artist or genre. Already heard/liked tracks are
 * only admitted as a final fallback when the fresh pool is too small.
 */
export function curateHomeRecommendations(
  tracks: Track[],
  options: HomeRecommendationOptions = {},
): Track[] {
  const limit = Math.max(0, options.limit ?? 20);
  if (limit === 0) return [];

  const excludedUrns = options.excludedUrns ?? new Set<string>();
  const blockedUrns = options.blockedUrns ?? new Set<string>();
  const seenInput = new Set<string>();
  const fresh: Track[] = [];
  const familiar: Track[] = [];

  for (const track of tracks) {
    if (!track.urn || seenInput.has(track.urn) || blockedUrns.has(track.urn)) continue;
    seenInput.add(track.urn);
    (excludedUrns.has(track.urn) || track.user_favorite ? familiar : fresh).push(track);
  }

  const selected: Track[] = [];
  const selectedUrns = new Set<string>();
  const artistCounts = new Map<string, number>();
  const genreCounts = new Map<string, number>();

  const append = (candidates: Track[], artistCap: number, genreCap: number) => {
    for (const track of candidates) {
      if (selected.length >= limit) return;
      if (selectedUrns.has(track.urn)) continue;

      const artist = artistKey(track);
      const genre = genreKey(track);
      if ((artistCounts.get(artist) ?? 0) >= artistCap) continue;
      if (genre && (genreCounts.get(genre) ?? 0) >= genreCap) continue;

      selected.push(track);
      selectedUrns.add(track.urn);
      artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
      if (genre) genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
  };

  // Strong diversity for the visible shelves, then relax without abandoning
  // fresh recommendations. Familiar tracks remain a last-resort cold fallback.
  append(fresh, 2, 4);
  append(fresh, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  append(familiar, 1, 3);
  append(familiar, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);

  return selected;
}
