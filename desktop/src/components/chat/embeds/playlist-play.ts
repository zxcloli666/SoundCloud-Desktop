import { api } from '../../../lib/api';
import { type PagedResponse, pagedUrl } from '../../../lib/hooks';
import { queryClient } from '../../../lib/query-client';
import { armPlaylistContinuation } from '../../../lib/queue-continuation';
import { type Track, usePlayerStore } from '../../../stores/player';

const FIRST_PAGE = 200;
const PAGE_STALE_MS = 5 * 60_000;

function firstPage(urn: string): Promise<Track[]> {
  return queryClient.fetchQuery({
    queryKey: ['chat', 'embed-playlist', urn],
    queryFn: async () => {
      const base = `/playlists/${encodeURIComponent(urn)}/tracks`;
      const page = await api<PagedResponse<Track>>(pagedUrl(base, 0, FIRST_PAGE));
      return page.collection;
    },
    staleTime: PAGE_STALE_MS,
  });
}

export async function playPlaylist(
  urn: string,
  fallback: Track[],
  { index = 0, shuffle = false }: { index?: number; shuffle?: boolean } = {},
): Promise<void> {
  const loaded = await firstPage(urn).catch(() => [] as Track[]);
  const tracks = loaded.length > 0 ? loaded : fallback;
  if (tracks.length === 0) return;
  const player = usePlayerStore.getState();
  if (shuffle && !player.shuffle) usePlayerStore.setState({ shuffle: true });
  const wanted = fallback[index]?.urn;
  const start = shuffle
    ? Math.floor(Math.random() * tracks.length)
    : Math.max(
        0,
        tracks.findIndex((track) => track.urn === wanted),
      );
  player.play(tracks[start], tracks);
  if (loaded.length > 0) armPlaylistContinuation(urn);
}
