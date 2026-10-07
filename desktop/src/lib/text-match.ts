import type { Track } from '../stores/player';
import { getDisplayTitle, getTrackDisplay } from './track-display';

const MARKS = /\p{M}/gu;
const SPACES = /\s+/g;

export function searchKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/ı/g, 'i')
    .normalize('NFKD')
    .replace(MARKS, '')
    .replace(SPACES, ' ')
    .trim();
}

export function queryTerms(query: string): string[] {
  const key = searchKey(query);
  return key ? key.split(' ') : [];
}

export function matchesTerms(terms: string[], ...fields: (string | null | undefined)[]): boolean {
  if (terms.length === 0) return true;
  const haystack = searchKey(fields.filter(Boolean).join(' '));
  return terms.every((term) => haystack.includes(term));
}

const TRACK_KEYS = new WeakMap<Track, { enrichment: Track['enrichment']; key: string }>();

function trackKey(track: Track): string {
  const cached = TRACK_KEYS.get(track);
  if (cached && cached.enrichment === track.enrichment) return cached.key;
  const key = searchKey(
    [
      track.title,
      getDisplayTitle(track),
      getTrackDisplay(track).artistLine,
      track.enrichment?.primary_artist?.name,
      track.user?.username,
    ]
      .filter(Boolean)
      .join(' '),
  );
  TRACK_KEYS.set(track, { enrichment: track.enrichment, key });
  return key;
}

export function filterTracks(tracks: Track[], query: string): Track[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return tracks;
  return tracks.filter((track) => {
    const key = trackKey(track);
    return terms.every((term) => key.includes(term));
  });
}
