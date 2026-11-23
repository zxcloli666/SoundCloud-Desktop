import { useMemo } from 'react';
import type { Track } from '../../stores/player';
import { type GenreShare, topGenres } from '../search/utils';

export function usePlaylistGenres(tracks: Track[], fallbackGenre?: string | null): GenreShare[] {
  const sig =
    tracks.length === 0
      ? ''
      : `${tracks.length}:${tracks[0]?.urn}:${tracks[tracks.length - 1]?.urn}`;

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the cheap signature
  return useMemo(() => topGenres(tracks, 3, fallbackGenre), [sig, fallbackGenre]);
}
