import type { Track } from '../stores/player';
import { scDateMs } from './formatters';
import { arrangeTracks } from './track-order';

export type TrackSort =
  | 'default'
  | 'reverse'
  | 'released'
  | 'plays'
  | 'likes'
  | 'reposts'
  | 'title'
  | 'artist'
  | 'duration';

export const TRACK_SORTS: TrackSort[] = [
  'default',
  'reverse',
  'released',
  'plays',
  'likes',
  'reposts',
  'title',
  'artist',
  'duration',
];

function releasedAt(track: Track): number | null {
  const ms = scDateMs(track.enrichment?.release_date ?? track.release_date ?? track.created_at);
  return ms !== 0 ? ms : null;
}

const METRICS: Record<'released' | 'plays' | 'likes' | 'reposts', (t: Track) => number | null> = {
  released: releasedAt,
  plays: (t) => t.playback_count ?? null,
  likes: (t) => t.favoritings_count ?? t.likes_count ?? null,
  reposts: (t) => t.reposts_count ?? null,
};

function sortByMetricDesc(tracks: Track[], metric: (t: Track) => number | null): Track[] {
  return tracks
    .map((track, index) => ({ track, index, value: metric(track) }))
    .sort((a, b) => {
      if (a.value == null || b.value == null) {
        if (a.value != null) return -1;
        if (b.value != null) return 1;
        return a.index - b.index;
      }
      return b.value - a.value || a.index - b.index;
    })
    .map((entry) => entry.track);
}

export function sortTracks(tracks: Track[], sort: TrackSort, locale: string): Track[] {
  if (sort === 'default') return tracks;
  if (sort === 'reverse' || sort === 'title' || sort === 'artist' || sort === 'duration') {
    return arrangeTracks(tracks, sort, locale);
  }
  return sortByMetricDesc(tracks, METRICS[sort]);
}
