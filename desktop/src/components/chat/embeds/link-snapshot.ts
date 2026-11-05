import { api } from '../../../lib/api';
import { playlistEmbed, trackEmbed, userEmbed } from '../../../lib/chat/embed-snapshot';
import type { ChatLink } from '../../../lib/chat/soundcloud-link';
import type { Embed } from '../../../lib/chat/types';
import type { Playlist, UserProfile } from '../../../lib/hooks';
import { kindOf } from '../../../lib/ids';
import { queryClient } from '../../../lib/query-client';
import { resolveLink } from '../../../lib/search';
import { fullTrack } from './embed-track';

const ENTITY_STALE_MS = 5 * 60_000;

function fetchEntity<T>(kind: 'playlist' | 'user', path: string, urn: string): Promise<T> {
  return queryClient.fetchQuery({
    queryKey: [kind, urn],
    queryFn: () => api<T>(`/${path}/${encodeURIComponent(urn)}`),
    staleTime: ENTITY_STALE_MS,
  });
}

async function linkUrn(found: ChatLink): Promise<string> {
  if (found.link.kind === 'urn') return found.link.urn;
  return (await resolveLink(found.link.url)).urn;
}

export async function snapshotFromLink(found: ChatLink): Promise<Embed | null> {
  const urn = await linkUrn(found);
  switch (kindOf(urn)) {
    case 'tracks':
      return trackEmbed(await fullTrack(urn), found.atMs, found.secretToken);
    case 'playlists':
      return playlistEmbed(
        await fetchEntity<Playlist>('playlist', 'playlists', urn),
        found.secretToken,
      );
    case 'users':
      return userEmbed(await fetchEntity<UserProfile>('user', 'users', urn));
    default:
      return null;
  }
}
