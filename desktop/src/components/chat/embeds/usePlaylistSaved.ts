import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';

const SAVED_STALE_MS = 5 * 60_000;

export function usePlaylistSaved(urn: string, visible: boolean) {
  const qc = useQueryClient();
  const queryKey = ['likes', 'playlist', urn];
  const { data } = useQuery({
    queryKey,
    queryFn: () => api<{ liked: boolean }>(`/likes/playlists/${encodeURIComponent(urn)}`),
    enabled: visible && !!urn,
    staleTime: SAVED_STALE_MS,
  });
  const saved = data?.liked ?? false;

  const toggle = async () => {
    const next = !saved;
    qc.setQueryData(queryKey, { liked: next });
    try {
      await api(`/likes/playlists/${encodeURIComponent(urn)}`, {
        method: next ? 'POST' : 'DELETE',
      });
      void qc.invalidateQueries({ queryKey: ['me', 'likes', 'playlists'] });
    } catch {
      qc.setQueryData(queryKey, { liked: !next });
    }
  };

  return { saved, toggle };
}
