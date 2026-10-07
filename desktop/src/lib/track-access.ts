import type { Track } from '../stores/player';

export function isPreviewOnly(track: Pick<Track, 'access' | 'policy'>): boolean {
  return track.access === 'preview' || track.policy === 'SNIP';
}
