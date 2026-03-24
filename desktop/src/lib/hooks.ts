import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import type { Track } from '../stores/player';
import { api } from './api';
import { initLikedUrns } from './likes';

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
  permalink_url?: string;
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
  user_favorite?: boolean;
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
const SHORT_CACHE_MS = 1000 * 60 * 2;
const MEDIUM_CACHE_MS = 1000 * 60 * 5;
const SEARCH_CACHE_MS = 1000 * 60 * 2;
const INFINITE_GC_MS = 1000 * 60 * 3;

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

function flattenCollectionPages<T>(pages: Array<{ collection: T[] }> | undefined): T[] {
  if (!pages) return [];
  const items: T[] = [];
  for (const page of pages) {
    items.push(...page.collection);
  }
  return items;
}

export function dedupeByKey<T, K>(items: T[], getKey: (item: T) => K): T[] {
  const seen = new Set<K>();
  const unique: T[] = [];
  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

export function dedupeByUrn<T extends { urn: string }>(items: T[]): T[] {
  return dedupeByKey(items, (item) => item.urn);
}

/* ── History ───────────────────────────────────────────────────── */

export interface HistoryEntry {
  id: string;
  scTrackId: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  duration: number;
  playedAt: string;
}

export function useHistory(limit = 50) {
  const query = useInfiniteQuery({
    queryKey: ['history'],
    queryFn: async ({ pageParam = 0 }) => {
      return api<{ collection: HistoryEntry[]; total: number }>(
        `/history?limit=${limit}&offset=${pageParam}`,
      );
    },
    initialPageParam: 0,
    gcTime: INFINITE_GC_MS,
    maxPages: 8,
    getNextPageParam: (last, _all, lastOffset) => {
      const nextOffset = (lastOffset as number) + limit;
      return nextOffset < last.total ? nextOffset : undefined;
    },
    staleTime: 0,
  });

  const entries = useMemo(() => {
    return flattenCollectionPages(query.data?.pages);
  }, [query.data]);

  return { entries, ...query };
}

/* ── Local Likes ──────────────────────────────────────────────── */

export function useLocalLikes(limit = 50) {
  const query = useInfiniteQuery({
    queryKey: ['local-likes'],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (pageParam) params.set('cursor', pageParam as string);
      return api<TrackListResponse>(`/local-likes?${params}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => {
      if (!last.next_href) return undefined;
      try {
        const url = new URL(last.next_href, 'http://x');
        return url.searchParams.get('cursor') || undefined;
      } catch {
        return undefined;
      }
    },
    staleTime: 0,
  });

  const tracks = useMemo(() => {
    return flattenCollectionPages(query.data?.pages);
  }, [query.data]);

  return { tracks, ...query };
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
    gcTime: INFINITE_GC_MS,
    maxPages: 8,
    getNextPageParam: (last, _all, lastPageParam) => {
      const next = extractPagination(last.next_href);
      if (!next) return undefined;
      if (lastPageParam && JSON.stringify(next) === JSON.stringify(lastPageParam)) {
        return undefined;
      }
      return next;
    },
    staleTime: SHORT_CACHE_MS,
  });

  const items = useMemo(() => {
    return dedupeByKey(
      flattenCollectionPages(query.data?.pages),
      (item) => item.origin?.urn ?? `${item.type}:${item.created_at}`,
    );
  }, [query.data]);

  return {
    items,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
  };
}

/* ── Liked tracks ──────────────────────────────────────────────── */

export function useLikedTracks(limit = 30) {
  const query = useInfiniteQuery({
    queryKey: ['me', 'likes', 'tracks', limit],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (pageParam) {
        for (const [key, val] of Object.entries(pageParam)) {
          params.set(key, val);
        }
      }
      return api<TrackListResponse>(`/me/likes/tracks?${params}`);
    },
    initialPageParam: undefined as PageParam | undefined,
    gcTime: INFINITE_GC_MS,
    getNextPageParam: (last, _all, lastPageParam) => {
      const next = extractPagination(last.next_href);
      if (!next) return undefined;
      if (lastPageParam && JSON.stringify(next) === JSON.stringify(lastPageParam)) return undefined;
      return next;
    },
    staleTime: SHORT_CACHE_MS,
  });

  const tracks = useMemo(() => {
    return flattenCollectionPages(query.data?.pages);
  }, [query.data]);

  // Seed global liked URNs store
  useEffect(() => {
    if (tracks.length > 0) initLikedUrns(tracks);
  }, [tracks]);

  return { tracks, ...query };
}

/**
 * Fetch ALL liked tracks by paginating through the API.
 * Module-level cache — shared across shuffle & play, no re-renders.
 * Call invalidateAllLikesCache() when likes change.
 */
let _allLikesPromise: Promise<Track[]> | null = null;

export function fetchAllLikedTracks(pageSize = 200): Promise<Track[]> {
  if (_allLikesPromise) return _allLikesPromise;

  _allLikesPromise = (async () => {
    const all: Track[] = [];
    let cursor: string | undefined;

    for (;;) {
      const params = new URLSearchParams({ limit: String(pageSize) });
      if (cursor) params.set('cursor', cursor);

      const page = await api<TrackListResponse>(`/me/likes/tracks?${params}`);
      for (const t of page.collection) all.push(t);

      const next = page.next_href ? extractPagination(page.next_href) : undefined;
      if (!next?.cursor) break;
      cursor = next.cursor;
    }

    return all;
  })();

  _allLikesPromise.catch(() => {
    _allLikesPromise = null;
  });

  return _allLikesPromise;
}

export function invalidateAllLikesCache() {
  _allLikesPromise = null;
}

/* ── Fresh from followed artists ───────────────────────────────── */

export function useFollowingTracks(limit = 20) {
  return useQuery({
    queryKey: ['me', 'followings', 'tracks', limit],
    queryFn: () => api<TrackListResponse>(`/me/followings/tracks?limit=${limit}`),
    staleTime: SHORT_CACHE_MS,
    gcTime: INFINITE_GC_MS,
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
    gcTime: INFINITE_GC_MS,
    maxPages: 6,
    getNextPageParam: (last, _all, lastPageParam) => {
      const next = extractPagination(last.next_href);
      if (!next) return undefined;
      if (lastPageParam && JSON.stringify(next) === JSON.stringify(lastPageParam)) return undefined;
      return next;
    },
    enabled: !!trackUrn,
    staleTime: SHORT_CACHE_MS,
  });

  const comments = useMemo(() => {
    return flattenCollectionPages(query.data?.pages);
  }, [query.data]);

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
    staleTime: SHORT_CACHE_MS,
    gcTime: INFINITE_GC_MS,
  });
}

/* ── Track Favoriters ─────────────────────────────────────────── */

export function useTrackFavoriters(trackUrn: string | undefined, limit = 12) {
  return useQuery({
    queryKey: ['track', trackUrn, 'favoriters', limit],
    queryFn: () =>
      api<UserListResponse>(`/tracks/${encodeURIComponent(trackUrn!)}/favoriters?limit=${limit}`),
    enabled: !!trackUrn,
    staleTime: SHORT_CACHE_MS,
    gcTime: INFINITE_GC_MS,
  });
}

/* ── Playlist Detail ──────────────────────────────────────────── */

export function usePlaylist(playlistUrn: string | undefined) {
  return useQuery({
    queryKey: ['playlist', playlistUrn],
    queryFn: () => api<Playlist>(`/playlists/${encodeURIComponent(playlistUrn!)}`),
    enabled: !!playlistUrn,
    staleTime: MEDIUM_CACHE_MS,
    gcTime: INFINITE_GC_MS,
  });
}

/* ── Playlist Tracks ──────────────────────────────────────────── */

export function usePlaylistTracks(playlistUrn: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: ['playlist', playlistUrn, 'tracks'],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '200' });
      if (pageParam) {
        for (const [key, val] of Object.entries(pageParam)) {
          params.set(key, val);
        }
      }
      return api<TrackListResponse>(
        `/playlists/${encodeURIComponent(playlistUrn!)}/tracks?${params}`,
      );
    },
    initialPageParam: undefined as PageParam | undefined,
    getNextPageParam: (last, _all, lastPageParam) => {
      const next = extractPagination(last.next_href);
      if (!next) return undefined;
      if (lastPageParam && JSON.stringify(next) === JSON.stringify(lastPageParam)) return undefined;
      return next;
    },
    enabled: !!playlistUrn,
    staleTime: MEDIUM_CACHE_MS,
    gcTime: INFINITE_GC_MS,
  });

  // Auto-fetch all pages so full playlist loads without scrolling
  useEffect(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [query.hasNextPage, query.isFetchingNextPage, query.data]);

  const tracks = useMemo(() => {
    return flattenCollectionPages(query.data?.pages);
  }, [query.data]);
  return { tracks, ...query };
}

/* ── User Profile ─────────────────────────────────────────────── */

export function useUser(userUrn: string | undefined) {
  return useQuery({
    queryKey: ['user', userUrn],
    queryFn: () => api<UserProfile>(`/users/${encodeURIComponent(userUrn!)}`),
    enabled: !!userUrn,
    staleTime: MEDIUM_CACHE_MS,
    gcTime: INFINITE_GC_MS,
  });
}

export function useUserTracks(userUrn: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: ['user', userUrn, 'tracks'],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '30', access: 'playable,preview,blocked' });
      if (pageParam) {
        for (const [key, val] of Object.entries(pageParam)) {
          params.set(key, val);
        }
      }
      return api<TrackListResponse>(`/users/${encodeURIComponent(userUrn!)}/tracks?${params}`);
    },
    initialPageParam: undefined as PageParam | undefined,
    gcTime: INFINITE_GC_MS,
    maxPages: 8,
    getNextPageParam: (last, _all, lastPageParam) => {
      const next = extractPagination(last.next_href);
      if (!next) return undefined;
      if (lastPageParam && JSON.stringify(next) === JSON.stringify(lastPageParam)) return undefined;
      return next;
    },
    enabled: !!userUrn,
    staleTime: SHORT_CACHE_MS,
  });

  const tracks = useMemo(() => {
    return dedupeByUrn(flattenCollectionPages(query.data?.pages));
  }, [query.data]);
  return { tracks, ...query };
}

export function useUserPopularTracks(userUrn: string | undefined) {
  return useQuery({
    queryKey: ['user', userUrn, 'tracks', 'popular'],
    queryFn: async () => {
      const all: Track[] = [];
      let cursor: string | undefined;
      const pageSize = 50;

      // Paginate through all tracks
      for (;;) {
        const params = new URLSearchParams({
          limit: String(pageSize),
          access: 'playable,preview,blocked',
        });
        if (cursor) params.set('cursor', cursor);
        const page = await api<TrackListResponse>(
          `/users/${encodeURIComponent(userUrn!)}/tracks?${params}`,
        );
        for (const t of page.collection) all.push(t);

        const next = page.next_href ? extractPagination(page.next_href) : undefined;
        if (!next?.cursor || page.collection.length === 0) break;
        cursor = next.cursor;
      }

      all.sort((a, b) => (b.playback_count ?? 0) - (a.playback_count ?? 0));
      return all;
    },
    enabled: !!userUrn,
    staleTime: SHORT_CACHE_MS,
    gcTime: INFINITE_GC_MS,
  });
}

export function useUserPlaylists(userUrn: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: ['user', userUrn, 'playlists'],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '30' });
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
    gcTime: INFINITE_GC_MS,
    maxPages: 8,
    getNextPageParam: (last, _all, lastPageParam) => {
      const next = extractPagination(last.next_href);
      if (!next) return undefined;
      if (lastPageParam && JSON.stringify(next) === JSON.stringify(lastPageParam)) return undefined;
      return next;
    },
    enabled: !!userUrn,
    staleTime: SHORT_CACHE_MS,
  });

  const playlists = useMemo(() => {
    return dedupeByUrn(flattenCollectionPages(query.data?.pages));
  }, [query.data]);
  return { playlists, ...query };
}

export function useUserLikedTracks(userUrn: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: ['user', userUrn, 'likes', 'tracks'],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '30', access: 'playable,preview,blocked' });
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
    gcTime: INFINITE_GC_MS,
    maxPages: 8,
    getNextPageParam: (last, _all, lastPageParam) => {
      const next = extractPagination(last.next_href);
      if (!next) return undefined;
      if (lastPageParam && JSON.stringify(next) === JSON.stringify(lastPageParam)) return undefined;
      return next;
    },
    enabled: !!userUrn,
    staleTime: SHORT_CACHE_MS,
  });

  const tracks = useMemo(() => {
    return dedupeByUrn(flattenCollectionPages(query.data?.pages));
  }, [query.data]);
  return { tracks, ...query };
}

export function useUserFollowings(userUrn: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: ['user', userUrn, 'followings'],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '30' });
      if (pageParam) {
        for (const [key, val] of Object.entries(pageParam)) {
          params.set(key, val);
        }
      }
      return api<UserListResponse>(`/users/${encodeURIComponent(userUrn!)}/followings?${params}`);
    },
    initialPageParam: undefined as PageParam | undefined,
    gcTime: INFINITE_GC_MS,
    maxPages: 8,
    getNextPageParam: (last, _all, lastPageParam) => {
      const next = extractPagination(last.next_href);
      if (!next) return undefined;
      if (lastPageParam && JSON.stringify(next) === JSON.stringify(lastPageParam)) return undefined;
      return next;
    },
    enabled: !!userUrn,
    staleTime: SHORT_CACHE_MS,
  });

  const users = useMemo(() => {
    return dedupeByUrn(flattenCollectionPages(query.data?.pages));
  }, [query.data]);
  return { users, ...query };
}

export function useUserFollowers(userUrn: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: ['user', userUrn, 'followers'],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '30' });
      if (pageParam) {
        for (const [key, val] of Object.entries(pageParam)) {
          params.set(key, val);
        }
      }
      return api<UserListResponse>(`/users/${encodeURIComponent(userUrn!)}/followers?${params}`);
    },
    initialPageParam: undefined as PageParam | undefined,
    gcTime: INFINITE_GC_MS,
    maxPages: 8,
    getNextPageParam: (last, _all, lastPageParam) => {
      const next = extractPagination(last.next_href);
      if (!next) return undefined;
      if (lastPageParam && JSON.stringify(next) === JSON.stringify(lastPageParam)) return undefined;
      return next;
    },
    enabled: !!userUrn,
    staleTime: SHORT_CACHE_MS,
  });

  const users = useMemo(() => {
    return dedupeByUrn(flattenCollectionPages(query.data?.pages));
  }, [query.data]);
  return { users, ...query };
}

export function useUserWebProfiles(userUrn: string | undefined) {
  return useQuery({
    queryKey: ['user', userUrn, 'web-profiles'],
    queryFn: () => api<WebProfile[]>(`/users/${encodeURIComponent(userUrn!)}/web-profiles`),
    enabled: !!userUrn,
    staleTime: MEDIUM_CACHE_MS,
    gcTime: INFINITE_GC_MS,
  });
}

/* ── My Library ────────────────────────────────────────────────── */

export function useMyFollowings(limit = 30) {
  const query = useInfiniteQuery({
    queryKey: ['me', 'followings', limit],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (pageParam) {
        for (const [key, val] of Object.entries(pageParam)) {
          params.set(key, val);
        }
      }
      return api<UserListResponse>(`/me/followings?${params}`);
    },
    initialPageParam: undefined as PageParam | undefined,
    gcTime: INFINITE_GC_MS,
    getNextPageParam: (last, _all, lastPageParam) => {
      const next = extractPagination(last.next_href);
      if (!next) return undefined;
      if (lastPageParam && JSON.stringify(next) === JSON.stringify(lastPageParam)) return undefined;
      return next;
    },
  });

  const users = useMemo(() => {
    return flattenCollectionPages(query.data?.pages);
  }, [query.data]);
  return { users, ...query };
}

export function useMyLikedPlaylists(limit = 30) {
  const query = useInfiniteQuery({
    queryKey: ['me', 'likes', 'playlists', limit],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (pageParam) {
        for (const [key, val] of Object.entries(pageParam)) {
          params.set(key, val);
        }
      }
      return api<PlaylistListResponse>(`/me/likes/playlists?${params}`);
    },
    initialPageParam: undefined as PageParam | undefined,
    gcTime: INFINITE_GC_MS,
    getNextPageParam: (last, _all, lastPageParam) => {
      const next = extractPagination(last.next_href);
      if (!next) return undefined;
      if (lastPageParam && JSON.stringify(next) === JSON.stringify(lastPageParam)) return undefined;
      return next;
    },
  });

  const playlists = useMemo(() => {
    return flattenCollectionPages(query.data?.pages);
  }, [query.data]);
  return { playlists, ...query };
}

export function useMyPlaylists(limit = 30) {
  const query = useInfiniteQuery({
    queryKey: ['me', 'playlists', limit],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (pageParam) {
        for (const [key, val] of Object.entries(pageParam)) {
          params.set(key, val);
        }
      }
      const res = await api<PlaylistListResponse | Playlist[]>(`/me/playlists?${params}`);
      if (Array.isArray(res)) {
        return { collection: res, next_href: null } as PlaylistListResponse;
      }
      return res;
    },
    initialPageParam: undefined as PageParam | undefined,
    gcTime: INFINITE_GC_MS,
    getNextPageParam: (last, _all, lastPageParam) => {
      const next = extractPagination(last.next_href);
      if (!next) return undefined;
      if (lastPageParam && JSON.stringify(next) === JSON.stringify(lastPageParam)) return undefined;
      return next;
    },
  });

  const playlists = useMemo(() => {
    return flattenCollectionPages(query.data?.pages);
  }, [query.data]);
  return { playlists, ...query };
}

/* ── Playlist Mutations ────────────────────────────────────────── */

export function useUpdatePlaylistTracks(playlistUrn: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trackUrns: string[]) =>
      api<Playlist>(`/playlists/${encodeURIComponent(playlistUrn!)}`, {
        method: 'PUT',
        body: JSON.stringify({ playlist: { tracks: trackUrns.map((urn) => ({ urn })) } }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(['playlist', playlistUrn], data);
      qc.invalidateQueries({ queryKey: ['playlist', playlistUrn, 'tracks'] });
      qc.invalidateQueries({ queryKey: ['me', 'playlists'] });
    },
  });
}

export function useAddToPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playlistUrn,
      existingTrackUrns,
      newTrackUrns,
    }: {
      playlistUrn: string;
      existingTrackUrns: string[];
      newTrackUrns: string[];
    }) => {
      const allUrns = [...existingTrackUrns, ...newTrackUrns];
      return api<Playlist>(`/playlists/${encodeURIComponent(playlistUrn)}`, {
        method: 'PUT',
        body: JSON.stringify({ playlist: { tracks: allUrns.map((urn) => ({ urn })) } }),
      });
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['playlist', vars.playlistUrn] });
      qc.invalidateQueries({ queryKey: ['playlist', vars.playlistUrn, 'tracks'] });
      qc.invalidateQueries({ queryKey: ['me', 'playlists'] });
    },
  });
}

export function useCreatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { title: string; sharing?: 'public' | 'private'; trackUrns?: string[] }) =>
      api<Playlist>('/playlists', {
        method: 'POST',
        body: JSON.stringify({
          playlist: {
            title: params.title,
            sharing: params.sharing ?? 'public',
            ...(params.trackUrns?.length
              ? { tracks: params.trackUrns.map((urn) => ({ urn })) }
              : {}),
          },
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'playlists'] });
    },
  });
}

export function useDeletePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playlistUrn: string) =>
      api(`/playlists/${encodeURIComponent(playlistUrn)}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'playlists'] });
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
    gcTime: INFINITE_GC_MS,
    maxPages: 5,
    getNextPageParam: (last, _all, lastPageParam) => {
      const next = extractPagination(last.next_href);
      if (!next) return undefined;
      if (lastPageParam && JSON.stringify(next) === JSON.stringify(lastPageParam)) return undefined;
      return next;
    },
    enabled: !!q.trim(),
    staleTime: SEARCH_CACHE_MS,
  });

  const tracks = useMemo(() => {
    return dedupeByUrn(flattenCollectionPages(query.data?.pages));
  }, [query.data]);
  return { tracks, ...query };
}

export function useSearchPlaylists(q: string) {
  const query = useInfiniteQuery({
    queryKey: ['search', 'playlists', q],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ q, limit: '20', linked_partitioning: 'true' });
      if (pageParam) {
        for (const [key, val] of Object.entries(pageParam)) {
          params.set(key, val);
        }
      }
      return api<PlaylistListResponse>(`/playlists?${params}`);
    },
    initialPageParam: undefined as PageParam | undefined,
    gcTime: INFINITE_GC_MS,
    maxPages: 5,
    getNextPageParam: (last, _all, _lastPageParam) => extractPagination(last.next_href),
    enabled: !!q.trim(),
    staleTime: SEARCH_CACHE_MS,
  });

  const playlists = useMemo(() => {
    return dedupeByUrn(flattenCollectionPages(query.data?.pages));
  }, [query.data]);
  return { playlists, ...query };
}

export function useSearchUsers(q: string) {
  const query = useInfiniteQuery({
    queryKey: ['search', 'users', q],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ q, limit: '20', linked_partitioning: 'true' });
      if (pageParam) {
        for (const [key, val] of Object.entries(pageParam)) {
          params.set(key, val);
        }
      }
      return api<UserListResponse>(`/users?${params}`);
    },
    initialPageParam: undefined as PageParam | undefined,
    gcTime: INFINITE_GC_MS,
    maxPages: 5,
    getNextPageParam: (last, _all, _lastPageParam) => extractPagination(last.next_href),
    enabled: !!q.trim(),
    staleTime: SEARCH_CACHE_MS,
  });

  const users = useMemo(() => {
    return dedupeByUrn(flattenCollectionPages(query.data?.pages));
  }, [query.data]);
  return { users, ...query };
}

/* ── Fallback / Seed Tracks ────────────────────────────────────── */

const FALLBACK_TRACK_IDS = '2028678528,2028677636,2078655668';

export function useFallbackTracks() {
  return useQuery({
    queryKey: ['fallback', 'tracks'],
    queryFn: () =>
      api<TrackListResponse>(`/tracks?ids=${FALLBACK_TRACK_IDS}&linked_partitioning=true`),
    staleTime: 1000 * 60 * 30,
  });
}

/* ── Discover ──────────────────────────────────────────────────── */

type RelatedPool = Map<string, { count: number; track: Track }>;

function sampleTrackUrns(tracks: Track[], limit: number): string[] {
  if (tracks.length <= limit) {
    return tracks.map((track) => track.urn);
  }

  const sample = tracks.slice(0, limit);
  for (let i = limit; i < tracks.length; i++) {
    const swapIndex = Math.floor(Math.random() * (i + 1));
    if (swapIndex < limit) {
      sample[swapIndex] = tracks[i];
    }
  }

  return sample.map((track) => track.urn);
}

/**
 * Shared pool: fetches related tracks for up to 30 random liked tracks,
 * counts frequency of each related track. Used by both Recommended and Discover.
 */
export function useRelatedPool(likedTracks: Track[]) {
  const seedUrns = useMemo(() => {
    if (likedTracks.length === 0) return [];
    return sampleTrackUrns(likedTracks, 30);
  }, [likedTracks]);

  const likedUrns = useMemo(() => new Set(likedTracks.map((t) => t.urn)), [likedTracks]);

  return useQuery({
    queryKey: ['discover', 'related-pool', seedUrns],
    queryFn: async () => {
      const results = await Promise.all(
        seedUrns.map((urn) =>
          api<TrackListResponse>(`/tracks/${encodeURIComponent(urn)}/related?limit=20`).catch(
            () => ({ collection: [] as Track[] }),
          ),
        ),
      );

      const freq: RelatedPool = new Map();
      for (const res of results) {
        for (const track of res.collection) {
          if (likedUrns.has(track.urn)) continue;
          const entry = freq.get(track.urn);
          if (entry) entry.count++;
          else freq.set(track.urn, { count: 1, track });
        }
      }
      return freq;
    },
    enabled: seedUrns.length > 0,
    staleTime: 1000 * 60 * 10,
    gcTime: INFINITE_GC_MS,
  });
}

/** Top related tracks sorted by frequency — "Recommended For You" */
export function useRecommendedTracks(pool: RelatedPool | undefined, limit = 40) {
  return useMemo(() => {
    if (!pool) return [];
    return [...pool.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map((e) => e.track);
  }, [pool, limit]);
}

/** Related tracks grouped by genre, sorted by frequency — "Discover" */
export function useDiscoverData(pool: RelatedPool | undefined, likedTracks: Track[]) {
  // Genre ranking from liked tracks
  const genreRanking = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of likedTracks) {
      const g = t.genre?.trim().toLowerCase();
      if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
  }, [likedTracks]);

  return useMemo(() => {
    if (!pool) return [];

    // Group pool tracks by their genre, count frequency within genre
    const byGenre = new Map<string, { count: number; track: Track }[]>();
    for (const entry of pool.values()) {
      const g = entry.track.genre?.trim().toLowerCase();
      if (!g) continue;
      const arr = byGenre.get(g);
      if (arr) arr.push(entry);
      else byGenre.set(g, [entry]);
    }

    // Sort tracks within each genre by frequency
    for (const arr of byGenre.values()) {
      arr.sort((a, b) => b.count - a.count);
    }

    // Walk genre ranking, skip genres with ≤3 tracks
    const result: { genre: string; tracks: Track[] }[] = [];
    for (const genre of genreRanking) {
      const entries = byGenre.get(genre);
      if (!entries || entries.length <= 3) continue;
      result.push({ genre, tracks: entries.map((e) => e.track) });
      if (result.length >= 7) break;
    }

    return result;
  }, [pool, genreRanking]);
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
