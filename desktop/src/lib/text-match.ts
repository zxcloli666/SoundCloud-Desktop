import type { Track } from '../stores/player';
import { queryTerms, searchKey } from './search-key';
import { getDisplayTitle, getTrackDisplay } from './track-display';

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
