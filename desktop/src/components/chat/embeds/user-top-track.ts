import { api } from '../../../lib/api';
import { type PagedResponse, pagedUrl } from '../../../lib/hooks';
import { queryClient } from '../../../lib/query-client';
import { type Track, usePlayerStore } from '../../../stores/player';

const SAMPLE = 50;
const TOP_STALE_MS = 10 * 60_000;

function byPlays(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => (b.playback_count ?? 0) - (a.playback_count ?? 0));
}

function topTracks(userUrn: string): Promise<Track[]> {
  const popular = queryClient.getQueryData<{ tracks: Track[] }>([
    'user',
    userUrn,
    'tracks',
    'popular',
  ]);
  if (popular?.tracks.length) return Promise.resolve(popular.tracks);
  return queryClient.fetchQuery({
    queryKey: ['chat', 'embed-user-top', userUrn],
    queryFn: async () => {
      const base = `/users/${encodeURIComponent(userUrn)}/tracks`;
      const page = await api<PagedResponse<Track>>(pagedUrl(base, 0, SAMPLE));
      return byPlays(page.collection);
    },
    staleTime: TOP_STALE_MS,
  });
}

export async function playUserTop(userUrn: string): Promise<boolean> {
  const tracks = await topTracks(userUrn).catch(() => [] as Track[]);
  if (tracks.length === 0) return false;
  usePlayerStore.getState().play(tracks[0], tracks);
  return true;
}
