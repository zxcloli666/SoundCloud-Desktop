import type { Track } from '../../stores/player';
import type { SCUser } from '../hooks';

const KEPT = 200;
const CHANGES_THEM = /^\/(likes\/tracks|me\/followings)\//;

export function likedArtists(liked: Track[], followed: SCUser[]): string[] {
  const likes = new Map<string, number>();
  for (const track of liked) {
    const name = (track.enrichment?.primary_artist?.name ?? track.user?.username)?.trim();
    if (name) likes.set(name, (likes.get(name) ?? 0) + 1);
  }
  const mostLiked = [...likes].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const names = followed.map((user) => user.username?.trim()).filter(Boolean);
  return [...new Set([...mostLiked, ...names])].slice(0, KEPT);
}

export function changesLikedArtists(path: string): boolean {
  return CHANGES_THEM.test(path);
}
