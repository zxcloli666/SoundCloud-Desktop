import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/http.ts';
import type { Playlist, TrackListResponse } from './types.ts';

export type { Playlist } from './types.ts';

export function usePlaylist(playlistUrn: string | undefined) {
  return useQuery({
    queryKey: ['playlist', playlistUrn],
    queryFn: () => api<Playlist>(`/playlists/${encodeURIComponent(playlistUrn!)}`),
    enabled: !!playlistUrn,
    refetchOnMount: 'always',
  });
}

export function usePlaylistTracks(playlistUrn: string | undefined) {
  return useQuery({
    queryKey: ['playlist', playlistUrn, 'tracks'],
    queryFn: () =>
      api<TrackListResponse>(`/playlists/${encodeURIComponent(playlistUrn!)}/tracks?limit=500`),
    enabled: !!playlistUrn,
    refetchOnMount: 'always',
  });
}
