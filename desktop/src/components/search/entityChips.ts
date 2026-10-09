import type { CatalogAlbum, CatalogArtist } from '../../lib/discover';
import { art } from '../../lib/formatters';
import type { Playlist, SCUser } from '../../lib/hooks';
import type { EntityItem } from './EntityStrip';

type Go = (path: string) => void;

export function artistChip(a: CatalogArtist, go: Go): EntityItem {
  return {
    key: `a-${a.id}`,
    label: a.name,
    image: art(a.avatar_url, 't120x120'),
    round: true,
    onClick: () => go(`/artist/${encodeURIComponent(a.id)}`),
  };
}

export function albumChip(a: CatalogAlbum, go: Go): EntityItem {
  return {
    key: `al-${a.id}`,
    label: a.title,
    sub: a.primary_artist?.name,
    image: art(a.cover_url, 't120x120'),
    round: false,
    onClick: () => go(`/album/${encodeURIComponent(a.id)}`),
  };
}

export function userChip(u: SCUser, go: Go): EntityItem {
  return {
    key: `u-${u.urn}`,
    label: u.username,
    image: art(u.avatar_url, 't120x120'),
    round: true,
    onClick: () => go(`/user/${encodeURIComponent(u.urn)}`),
  };
}

export function playlistChip(p: Playlist, go: Go): EntityItem {
  return {
    key: `p-${p.urn}`,
    label: p.title,
    sub: p.user?.username,
    image: art(p.artwork_url, 't120x120'),
    round: false,
    onClick: () => go(`/playlist/${encodeURIComponent(p.urn)}`),
  };
}
