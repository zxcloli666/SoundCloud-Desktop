import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../lib/http.ts';
import { extractPagination, type PageParam } from './pagination.ts';
import type {
  Playlist,
  PlaylistListResponse,
  SCUser,
  Track,
  TrackListResponse,
  UserListResponse,
} from './types.ts';

export function useSearchTracks(q: string) {
  const query = useInfiniteQuery({
    queryKey: ['search', 'tracks', q],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        q,
        limit: '20',
        linked_partitioning: 'true',
      });
      if (pageParam) {
        for (const [key, val] of Object.entries(pageParam)) {
          params.set(key, val);
        }
      }
      return api<TrackListResponse>(`/tracks?${params}`);
    },
    initialPageParam: undefined as PageParam | undefined,
    getNextPageParam: (last, _all, lastPageParam) => {
      const next = extractPagination(last.next_href);
      if (!next) return undefined;
      if (lastPageParam && JSON.stringify(next) === JSON.stringify(lastPageParam)) return undefined;
      return next;
    },
    enabled: !!q.trim(),
    staleTime: 1000 * 60 * 5,
  });

  const tracks: Track[] = [];
  if (query.data) {
    for (const page of query.data.pages) {
      for (const t of page.collection) tracks.push(t);
    }
  }
  return { tracks, ...query };
}

export function useSearchPlaylists(q: string) {
  const query = useInfiniteQuery({
    queryKey: ['search', 'playlists', q],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        q,
        limit: '20',
        linked_partitioning: 'true',
      });
      if (pageParam) {
        for (const [key, val] of Object.entries(pageParam)) {
          params.set(key, val);
        }
      }
      return api<PlaylistListResponse>(`/playlists?${params}`);
    },
    initialPageParam: undefined as PageParam | undefined,
    getNextPageParam: (last) => extractPagination(last.next_href),
    enabled: !!q.trim(),
  });

  const playlists: Playlist[] = [];
  if (query.data) {
    for (const page of query.data.pages) {
      for (const p of page.collection) playlists.push(p);
    }
  }
  return { playlists, ...query };
}

export function useSearchUsers(q: string) {
  const query = useInfiniteQuery({
    queryKey: ['search', 'users', q],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        q,
        limit: '20',
        linked_partitioning: 'true',
      });
      if (pageParam) {
        for (const [key, val] of Object.entries(pageParam)) {
          params.set(key, val);
        }
      }
      return api<UserListResponse>(`/users?${params}`);
    },
    initialPageParam: undefined as PageParam | undefined,
    getNextPageParam: (last) => extractPagination(last.next_href),
    enabled: !!q.trim(),
  });

  const users: SCUser[] = [];
  if (query.data) {
    for (const page of query.data.pages) {
      for (const u of page.collection) users.push(u);
    }
  }
  return { users, ...query };
}
