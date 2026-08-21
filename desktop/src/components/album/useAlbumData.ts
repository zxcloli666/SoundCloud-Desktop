import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { AlbumDetail } from './types';

const STALE_DETAIL = 60_000;

export function useAlbumDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['album', id],
    queryFn: ({ signal }) => api<AlbumDetail>(`/albums/${encodeURIComponent(id!)}`, { signal }),
    enabled: !!id,
    staleTime: STALE_DETAIL,
  });
}
