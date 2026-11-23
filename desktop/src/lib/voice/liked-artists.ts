import type { Track } from '../../stores/player';
import type { SCUser } from '../hooks';

const KEPT = 200;
const CHANGES_THEM = /^\/(likes\/tracks|me\/followings|superlikes)\/soundcloud/;

export function artistOf(track: Track): string | undefined {
  return (track.enrichment?.primary_artist?.name ?? track.user?.username)?.trim() || undefined;
}

export function likedArtists(liked: Track[], followed: SCUser[]): string[] {
  const likes = new Map<string, number>();
  for (const track of liked) {
    const name = artistOf(track);
    if (name) likes.set(name, (likes.get(name) ?? 0) + 1);
  }
  const mostLiked = [...likes].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const names = followed.map((user) => user.username?.trim()).filter(Boolean);
  return [...new Set([...mostLiked, ...names])].slice(0, KEPT);
}

export function changesLikedArtists(path: string): boolean {
  return CHANGES_THEM.test(path);
}
