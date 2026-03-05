import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { Track } from '../stores/player';
import { api } from './api';

/* ── Types ─────────────────────────────────────────────────────── */

export type FeedOrigin = Track & {
  track_count?: number;
  set_type?: string;
  tracks?: Track[];
};

export interface FeedItem {
  type: string;
  created_at: string;
  origin: FeedOrigin;
}

interface FeedResponse {
  collection: FeedItem[];
  next_href: string | null;
}

interface TrackListResponse {
  collection: Track[];
  next_href: string | null;
}

export interface Comment {
  id: number;
  urn: string;
  body: string;
  created_at: string;
  timestamp: number | null;
  track_id: number;
  user: {
    id: number;
    urn: string;
    username: string;
    avatar_url: string;
    permalink_url: string;
  };
}

interface CommentListResponse {
  collection: Comment[];
  next_href: string | null;
}

export interface Playlist {
  id: number;
  urn: string;
  title: string;
  description: string | null;
  duration: number;
  artwork_url: string | null;
  genre: string;
  tag_list: string;
  track_count: number;
  likes_count: number;
  repost_count: number;
  created_at: string;
  last_modified: string;
  sharing: string;
  playlist_type: string;
  tracks: Track[];
  user: {
    id: number;
    urn: string;
    username: string;
    avatar_url: string;
    permalink_url: string;
    followers_count?: number;
    track_count?: number;
  };
}

export interface SCUser {
  id: number;
  urn: string;
  username: string;
  avatar_url: string;
  permalink_url: string;
  followers_count?: number;
  followings_count?: number;
  track_count?: number;
  city?: string | null;
  country?: string | null;
}

export interface UserProfile extends SCUser {
  permalink: string;
  created_at: string;
  last_modified: string;
  first_name: string;
  last_name: string;
  full_name: string;
  description: string | null;
  country: string | null;
  public_favorites_count: number;
  reposts_count: number;
  plan: string;
  website_title: string | null;
  website: string | null;
  comments_count: number;
  online: boolean;
  likes_count: number;
  playlist_count: number;
}

export interface WebProfile {
  id: number;
  kind: string;
  service: string;
  title: string;
  url: string;
  username?: string;
}

interface UserListResponse {
  collection: SCUser[];
  next_href: string | null;
}

interface PlaylistListResponse {
  collection: Playlist[];
  next_href: string | null;
}

type PageParam = Record<string, string>;

/* ── Helpers ───────────────────────────────────────────────────── */

/**
 * Extract pagination params (cursor/offset) from SC API next_href.
 * Forwards the exact param name SC uses, so the backend proxies it correctly.
 */
function extractPagination(href: string | null): PageParam | undefined {
  if (!href) return undefined;
  try {
    const url = new URL(href);
    const params: PageParam = {};
    for (const key of ['cursor', 'offset']) {
      const val = url.searchParams.get(key);
      if (val) params[key] = val;
    }
    return Object.keys(params).length > 0 ? params : undefined;
  } catch {
    return undefined;
  }
}

/* ── Feed ──────────────────────────────────────────────────────── */

export function useFeed() {
  const query = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (pageParam) {
        for (const [key, val] of Object.entries(pageParam)) {
          params.set(key, val);
        }
      }
      return api<FeedResponse>(`/me/feed?${params}`);
    },
    initialPageParam: undefined as PageParam | undefined,
    getNextPageParam: (last, _all, lastPageParam) => {
      const next = extractPagination(last.next_href);
      if (!next) return undefined;
      // Prevent infinite loop: stop if pagination params didn't change
      if (lastPageParam && JSON.stringify(next) === JSON.stringify(lastPageParam)) {
        return undefined;
      }
      return next;
    },
    select: (data) => {
      const items: FeedItem[] = [];
      const seen = new Set<string>();
      for (const page of data.pages) {
        for (const item of page.collection) {
          const urn = item.origin?.urn;
          if (urn && !seen.has(urn)) {
            seen.add(urn);
            items.push(item);
          }
        }
      }
      return items;
    },
  });

  return {
    items: query.data ?? [],
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
  };
}

/* ── Liked tracks ──────────────────────────────────────────────── */

export function useLikedTracks(limit = 10) {
  return useQuery({
    queryKey: ['me', 'likes', 'tracks', limit],
    queryFn: () => api<TrackListResponse>(`/me/likes/tracks?limit=${limit}`),
  });
}

/* ── Fresh from followed artists ───────────────────────────────── */

export function useFollowingTracks(limit = 20) {
  return useQuery({
    queryKey: ['me', 'followings', 'tracks', limit],
    queryFn: () => api<TrackListResponse>(`/me/followings/tracks?limit=${limit}`),
  });
}

/* ── Track Comments (infinite) ─────────────────────────────────── */

export function useTrackComments(trackUrn: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: ['track', trackUrn, 'comments'],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (pageParam) {
        for (const [key, val] of Object.entries(pageParam)) {
          params.set(key, val);
        }
      }
      return api<CommentListResponse>(
        `/tracks/${encodeURIComponent(trackUrn!)}/comments?${params}`,
      );
    },
    initialPageParam: undefined as PageParam | undefined,
    getNextPageParam: (last, _all, lastPageParam) => {
      const next = extractPagination(last.next_href);
      if (!next) return undefined;
      if (lastPageParam && JSON.stringify(next) === JSON.stringify(lastPageParam)) return undefined;
      return next;
    },
    enabled: !!trackUrn,
    refetchOnMount: 'always',
  });

  const comments: Comment[] = [];
  if (query.data) {
    for (const page of query.data.pages) {
      for (const c of page.collection) comments.push(c);
    }
  }

  return { comments, ...query };
}

/* ── Post Comment ─────────────────────────────────────────────── */

export function usePostComment(trackUrn: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, timestamp }: { body: string; timestamp?: number }) => {
      return api<Comment>(`/tracks/${encodeURIComponent(trackUrn!)}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          comment: { body, timestamp: timestamp ?? 0 },
        }),
      });
    },
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ['track', trackUrn, 'comments'] });
      qc.refetchQueries({ queryKey: ['track', trackUrn], exact: true });
    },
  });
}

/* ── Related Tracks ───────────────────────────────────────────── */

export function useRelatedTracks(trackUrn: string | undefined, limit = 10) {
  return useQuery({
    queryKey: ['track', trackUrn, 'related', limit],
    queryFn: () =>
      api<TrackListResponse>(`/tracks/${encodeURIComponent(trackUrn!)}/related?limit=${limit}`),
    enabled: !!trackUrn,
    refetchOnMount: 'always',
  });
}

/* ── Track Favoriters ─────────────────────────────────────────── */

export function useTrackFavoriters(trackUrn: string | undefined, limit = 12) {
  return useQuery({
    queryKey: ['track', trackUrn, 'favoriters', limit],
    queryFn: () =>
      api<UserListResponse>(`/tracks/${encodeURIComponent(trackUrn!)}/favoriters?limit=${limit}`),
    enabled: !!trackUrn,
    refetchOnMount: 'always',
  });
}

/* ── Playlist Detail ──────────────────────────────────────────── */

export function usePlaylist(playlistUrn: string | undefined) {
  return useQuery({
    queryKey: ['playlist', playlistUrn],
    queryFn: () => api<Playlist>(`/playlists/${encodeURIComponent(playlistUrn!)}`),
    enabled: !!playlistUrn,
    refetchOnMount: 'always',
  });
}

/* ── Playlist Tracks ──────────────────────────────────────────── */

export function usePlaylistTracks(playlistUrn: string | undefined) {
  return useQuery({
    queryKey: ['playlist', playlistUrn, 'tracks'],
    queryFn: () =>
      api<TrackListResponse>(`/playlists/${encodeURIComponent(playlistUrn!)}/tracks?limit=500`),
    enabled: !!playlistUrn,
    refetchOnMount: 'always',
  });
}

/* ── User Profile ─────────────────────────────────────────────── */

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

/* ── My Library ────────────────────────────────────────────────── */

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
  // Для получения своих плейлистов часто используется /me/playlists или /users/{my_id}/playlists
  // Мы используем существующий endpoint пользователя, если знаем ID, или /me/playlists если он есть
  return useQuery({
    queryKey: ['me', 'playlists'],
    queryFn: async () => {
      // Пробуем получить через /me/playlists
      // Если бэк не поддерживает, можно переключиться на userUrn, но обычно /me/playlists работает
      const res = await api<Playlist[] | { collection?: Playlist[] }>(`/me/playlists`);
      // API может возвращать массив или объект с collection. Обработаем оба варианта.
      return Array.isArray(res) ? res : (res.collection ?? []);
    },
  });
}

/* ── Search ────────────────────────────────────────────────────── */

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
    staleTime: 1000 * 60 * 5, // 5 min cache for search results
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
    getNextPageParam: (last, _all, _lastPageParam) => extractPagination(last.next_href),
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
    getNextPageParam: (last, _all, _lastPageParam) => extractPagination(last.next_href),
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

/* ── Discover ──────────────────────────────────────────────────── */

export function useGenreTracks(genre: string, limit = 20) {
  return useQuery({
    queryKey: ['discover', 'genre', genre, limit],
    queryFn: () =>
      api<TrackListResponse>(
        `/tracks?genres=${encodeURIComponent(genre)}&limit=${limit}&linked_partitioning=true&access=playable`,
      ),
    staleTime: 1000 * 60 * 10,
  });
}

export function useRecommendedTracks(seedTrackUrn: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ['discover', 'related', seedTrackUrn, limit],
    queryFn: () =>
      api<TrackListResponse>(`/tracks/${encodeURIComponent(seedTrackUrn!)}/related?limit=${limit}`),
    enabled: !!seedTrackUrn,
    staleTime: 1000 * 60 * 10,
  });
}

/* ── Infinite scroll ───────────────────────────────────────────── */

export function useInfiniteScroll(
  hasNextPage: boolean,
  isFetchingNextPage: boolean,
  fetchNextPage: () => void,
) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;

    // Use the scrollable <main> as root so the observer
    // fires correctly inside the overflow container.
    const root = el.closest('main');

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          fetchNextPage();
        }
      },
      { root, rootMargin: '400px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return ref;
}
