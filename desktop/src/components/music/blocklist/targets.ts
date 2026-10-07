import type { BlockedArtist } from '../../../lib/blocked-artists';
import { idOf } from '../../../lib/ids';
import type { Track } from '../../../stores/player';
import type { ArtistDetail } from '../../artist/types';

export type BlockTarget = Omit<BlockedArtist, 'created_at'>;

export function artistTarget(artist: ArtistDetail): BlockTarget {
  return {
    kind: 'artist',
    id: artist.id,
    name: artist.name,
    avatar_url: artist.avatar_url ?? null,
    sc_user_ids: artist.sc_accounts.filter((a) => a.role === 'main').map((a) => a.sc_user_id),
  };
}

export function userTarget(user: {
  urn: string;
  username: string;
  avatar_url?: string | null;
}): BlockTarget | null {
  const id = idOf(user.urn);
  if (!id) return null;
  return {
    kind: 'user',
    id,
    name: user.username,
    avatar_url: user.avatar_url ?? null,
    sc_user_ids: [id],
  };
}

export function trackTargets(track: Track): BlockTarget[] {
  const out: BlockTarget[] = [];
  const primary = track.enrichment?.primary_artist;
  if (primary) {
    out.push({
      kind: 'artist',
      id: primary.id,
      name: primary.name,
      avatar_url: primary.avatar_url ?? null,
      sc_user_ids: primary.sc_user_id ? [primary.sc_user_id] : [],
    });
  }
  const uploader = userTarget(track.user);
  if (uploader && !out.some((t) => t.sc_user_ids.includes(uploader.id))) out.push(uploader);
  return out;
}
