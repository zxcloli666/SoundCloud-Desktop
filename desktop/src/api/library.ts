import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/http.ts';
import type { Playlist, PlaylistListResponse, UserListResponse } from './types.ts';

export function useMyFollowings(limit = 100) {
  return useQuery({
    queryKey: ['me', 'followings', limit],
    queryFn: () => api<UserListResponse>(`/me/followings?limit=${limit}`),
  });
}

export function useMyLikedPlaylists(limit = 100) {
  return useQuery({
    queryKey: ['me', 'likes', 'playlists', limit],
    queryFn: () => api<PlaylistListResponse>(`/me/likes/playlists?limit=${limit}`),
  });
}

export function useMyPlaylists() {
  return useQuery({
    queryKey: ['me', 'playlists'],
    queryFn: async () => {
      const res = await api<Playlist[] | { collection?: Playlist[] }>(`/me/playlists`);
      return Array.isArray(res) ? res : (res.collection ?? []);
    },
  });
}
