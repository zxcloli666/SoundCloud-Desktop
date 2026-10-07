import type { Track } from '../../stores/player';

export function roomTrack(track: Track): Track {
  const { enrichment: _enrichment, description: _description, ...rest } = track;
  const { description: _bio, ...user } = track.user;
  return { ...rest, user };
}
