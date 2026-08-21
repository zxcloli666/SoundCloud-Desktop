import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Aura } from '../../lib/aura';
import { useViewerAura } from '../../lib/useViewerAura';
import type { Track } from '../../stores/player';
import type { ArtistAlbum, ArtistDetail, TracksSort } from './types';

const STALE_DETAIL = 60_000;
const STALE_TRACKS = 30_000;
const STALE_ALBUMS = 120_000;

export function useArtistDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['artist', id],
    queryFn: ({ signal }) => api<ArtistDetail>(`/artists/${encodeURIComponent(id!)}`, { signal }),
    enabled: !!id,
    staleTime: STALE_DETAIL,
  });
}

export function useArtistTracks(
  id: string | undefined,
  role: 'primary' | 'featured',
  sort: TracksSort,
  limit = 80,
) {
  return useQuery({
    queryKey: ['artist', id, 'tracks', role, sort, limit],
    queryFn: ({ signal }) =>
      api<{ collection: Track[] }>(
        `/artists/${encodeURIComponent(id!)}/tracks?role=${role}&sort=${sort}&limit=${limit}`,
        { signal },
      ),
    enabled: !!id,
    staleTime: STALE_TRACKS,
    select: (d) => d.collection,
  });
}

export function useArtistCovers(id: string | undefined) {
  return useQuery({
    queryKey: ['artist', id, 'covers'],
    queryFn: ({ signal }) =>
      api<{ collection: Track[] }>(`/artists/${encodeURIComponent(id!)}/covers?limit=80`, {
        signal,
      }),
    enabled: !!id,
    staleTime: STALE_TRACKS,
    select: (d) => d.collection,
  });
}

export function useArtistAlbums(id: string | undefined) {
  return useQuery({
    queryKey: ['artist', id, 'albums'],
    queryFn: ({ signal }) =>
      api<ArtistAlbum[]>(`/artists/${encodeURIComponent(id!)}/albums`, { signal }),
    enabled: !!id,
    staleTime: STALE_ALBUMS,
  });
}

export interface ArtistStar {
  hasStar: boolean;
  aura: Aura;
}

export function useArtistStar(_id: string | undefined): ArtistStar {
  return { hasStar: false, aura: useViewerAura() };
}
