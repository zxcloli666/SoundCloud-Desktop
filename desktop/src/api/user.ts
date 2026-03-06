import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '../lib/http.ts';
import { extractPagination, type PageParam } from './pagination.ts';
import type {
  Playlist,
  PlaylistListResponse,
  Track,
  TrackListResponse,
  UserProfile,
  WebProfile,
} from './types.ts';

export type { SCUser, UserProfile, WebProfile } from './types.ts';

export function useUser(userUrn: string | undefined) {
  return useQuery({
    queryKey: ['user', userUrn],
    queryFn: () => api<UserProfile>(`/users/${encodeURIComponent(userUrn!)}`),
    enabled: !!userUrn,
    refetchOnMount: 'always',
  });
}

export function useUserTracks(userUrn: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: ['user', userUrn, 'tracks'],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        limit: '200',
        access: 'playable',
      });
      if (pageParam) {
        for (const [key, val] of Object.entries(pageParam)) {
          params.set(key, val);
        }
      }
      return api<TrackListResponse>(`/users/${encodeURIComponent(userUrn!)}/tracks?${params}`);
    },
    initialPageParam: undefined as PageParam | undefined,
    getNextPageParam: (last, _all, lastPageParam) => {
      const next = extractPagination(last.next_href);
      if (!next) return undefined;
      if (lastPageParam && JSON.stringify(next) === JSON.stringify(lastPageParam)) return undefined;
      return next;
    },
    enabled: !!userUrn,
    refetchOnMount: 'always',
  });

  const tracks: Track[] = [];
  if (query.data) {
    for (const page of query.data.pages) {
      for (const t of page.collection) tracks.push(t);
    }
  }
  return { tracks, ...query };
}

export function useUserPlaylists(userUrn: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: ['user', userUrn, 'playlists'],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '200' });
      if (pageParam) {
        for (const [key, val] of Object.entries(pageParam)) {
          params.set(key, val);
        }
      }
      return api<PlaylistListResponse>(
        `/users/${encodeURIComponent(userUrn!)}/playlists?${params}`,
      );
    },
    initialPageParam: undefined as PageParam | undefined,
    getNextPageParam: (last, _all, lastPageParam) => {
      const next = extractPagination(last.next_href);
      if (!next) return undefined;
      if (lastPageParam && JSON.stringify(next) === JSON.stringify(lastPageParam)) return undefined;
      return next;
    },
    enabled: !!userUrn,
    refetchOnMount: 'always',
  });

  const playlists: Playlist[] = [];
  if (query.data) {
    for (const page of query.data.pages) {
      for (const p of page.collection) playlists.push(p);
    }
  }
  return { playlists, ...query };
}

export function useUserLikedTracks(userUrn: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: ['user', userUrn, 'likes', 'tracks'],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        limit: '100',
        access: 'playable',
      });
      if (pageParam) {
        for (const [key, val] of Object.entries(pageParam)) {
          params.set(key, val);
        }
      }
      return api<TrackListResponse>(
        `/users/${encodeURIComponent(userUrn!)}/likes/tracks?${params}`,
      );
    },
    initialPageParam: undefined as PageParam | undefined,
    getNextPageParam: (last, _all, lastPageParam) => {
      const next = extractPagination(last.next_href);
      if (!next) return undefined;
      if (lastPageParam && JSON.stringify(next) === JSON.stringify(lastPageParam)) return undefined;
      return next;
    },
    enabled: !!userUrn,
    refetchOnMount: 'always',
  });

  const tracks: Track[] = [];
  if (query.data) {
    for (const page of query.data.pages) {
      for (const t of page.collection) tracks.push(t);
    }
  }
  return { tracks, ...query };
}

export function useUserWebProfiles(userUrn: string | undefined) {
  return useQuery({
    queryKey: ['user', userUrn, 'web-profiles'],
    queryFn: () => api<WebProfile[]>(`/users/${encodeURIComponent(userUrn!)}/web-profiles`),
    enabled: !!userUrn,
    refetchOnMount: 'always',
  });
}
