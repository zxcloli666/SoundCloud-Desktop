import type { Track } from '../../stores/player';
import { artistOf } from './liked-artists.ts';

export interface OwnedTrack {
  id: string;
  name: string;
  artist: string;
  plays: number;
  said?: string[];
  artistSaid?: string[];
}

export function ownedTracks(...lists: Track[][]): OwnedTrack[] {
  const seen = new Set<string>();
  const owned: OwnedTrack[] = [];
  for (const track of lists.flat()) {
    const name = track.title?.trim();
    if (!track.urn || !name || seen.has(track.urn)) continue;
    seen.add(track.urn);
    owned.push({
      id: track.urn,
      name,
      artist: artistOf(track) ?? '',
      plays: track.playback_count ?? 0,
    });
  }
  return owned;
}
