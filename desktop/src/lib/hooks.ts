import {
  type DefaultError,
  type InfiniteData,
  type QueryKey,
  type UseInfiniteQueryResult,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import type { Track } from '../stores/player';
import { api } from './api';
import { initLikedUrns } from './likes';
import { rememberLikedTracks, rememberTracks } from './offline-index';

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

export interface PagedResponse<T> {
  collection: T[];
  page: number;
  page_size: number;
  has_more: boolean;
}

type TrackPage = PagedResponse<Track>;

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

const SHORT_CACHE_MS = 1000 * 60 * 2;
const MEDIUM_CACHE_MS = 1000 * 60 * 5;
const SEARCH_CACHE_MS = 1000 * 60 * 2;
const INFINITE_GC_MS = 1000 * 60 * 3;

/* ── Helpers ───────────────────────────────────────────────────── */

function flattenCollectionPages<T>(pages: Array<{ collection: T[] }> | undefined): T[] {
  if (!pages) return [];
  const items: T[] = [];
  for (const page of pages) {
    if (!page?.collection) continue;
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

interface PagedQueryOptions<T> {
  queryKey: QueryKey;
  /** Builds the URL for a given page index. limit and page are appended automatically. */
  url: (page: number, limit: number) => string;
  limit?: number;
  staleTime?: number;
  gcTime?: number;
  enabled?: boolean;
  maxPages?: number;
  /** Auto-fetch all pages until exhausted. Use sparingly. */
  autoFetchAll?: boolean;
  dedupe?: (item: T) => string;
}

type PagedQueryResult<T> = UseInfiniteQueryResult<
  InfiniteData<PagedResponse<T>, number>,
  DefaultError
> & { items: T[] };

/**
 * Унифицированный page-based useInfiniteQuery helper. Бэк отдаёт
 * { collection, page, page_size, has_more } — этого достаточно для пагинации.
 */
function usePagedQuery<T>(opts: PagedQueryOptions<T>): PagedQueryResult<T> {
  const limit = opts.limit ?? 30;
  const query = useInfiniteQuery<
    PagedResponse<T>,
    DefaultError,
    InfiniteData<PagedResponse<T>, number>,
    QueryKey,
    number
  >({
    queryKey: opts.queryKey,
    queryFn: ({ pageParam }) => api<PagedResponse<T>>(opts.url(pageParam, limit)),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.has_more ? last.page + 1 : undefined),
    staleTime: opts.staleTime,
    gcTime: opts.gcTime ?? INFINITE_GC_MS,
    maxPages: opts.maxPages,
    enabled: opts.enabled,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: opts.autoFetchAll is stable, query is captured
  useEffect(() => {
    if (!opts.autoFetchAll) return;
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [opts.autoFetchAll, query.hasNextPage, query.isFetchingNextPage, query.data]);

  const items = useMemo(() => {
    const flat = flattenCollectionPages(query.data?.pages);
    return opts.dedupe ? dedupeByKey(flat, opts.dedupe) : flat;
  }, [query.data, opts.dedupe]);

  return Object.assign(query, { items }) as PagedQueryResult<T>;
}

function pagedUrl(base: string, page: number, limit: number, extra?: string): string {
  const sep = base.includes('?') ? '&' : '?';
  const params = `limit=${limit}&page=${page}${extra ? `&${extra}` : ''}`;
  return `${base}${sep}${params}`;
}

/* ── History ───────────────────────────────────────────────────── */

export interface HistoryEntry {
  id: string;
  scTrackId: string;
  title: string;
  artistName: string;
  artistUrn: string | null;
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

  const entries = useMemo(() => flattenCollectionPages(query.data?.pages), [query.data]);

  return { entries, ...query };
}

/* ── Featured ─────────────────────────────────────────────────── */

export interface FeaturedResponse {
  type: 'track' | 'playlist' | 'user';
  data: Track | Playlist | SCUser;
}

export function useFeatured() {
  return useQuery<FeaturedResponse | null>({
    queryKey: ['featured'],
    queryFn: () => api<FeaturedResponse | null>('/featured'),
    staleTime: 5 * 60_000,
  });
}

/* ── Local Likes ──────────────────────────────────────────────── */

interface LocalLikesPage {
  collection: Track[];
  next_href: string | null;
}

export function useLocalLikes(limit = 50) {
  const query = useInfiniteQuery({
    queryKey: ['local-likes'],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (pageParam) params.set('cursor', pageParam as string);
      return api<LocalLikesPage>(`/local-likes?${params}`);
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

  const tracks = useMemo(() => flattenCollectionPages(query.data?.pages), [query.data]);

  return { tracks, ...query };
}

/* ── Feed ──────────────────────────────────────────────────────── */

export function useFeed() {
  const query = usePagedQuery<FeedItem>({
    queryKey: ['feed'],
    url: (page, limit) => pagedUrl('/me/feed', page, limit),
    limit: 20,
    staleTime: SHORT_CACHE_MS,
    maxPages: 8,
    dedupe: (item) => item.origin?.urn ?? `${item.type}:${item.created_at}`,
  });

  return {
    items: query.items,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
  };
}

/* ── Liked tracks ──────────────────────────────────────────────── */

export function useLikedTracks(limit = 30) {
  const query = usePagedQuery<Track>({
    queryKey: ['me', 'likes', 'tracks', limit],
    url: (page, l) => pagedUrl('/me/likes/tracks', page, l),
    limit,
    staleTime: SHORT_CACHE_MS,
  });

  const tracks = query.items;

  useEffect(() => {
    if (tracks.length > 0) initLikedUrns(tracks);
  }, [tracks]);

  useEffect(() => {
    if (!query.data) return;
    void rememberLikedTracks(tracks);
  }, [query.data, tracks]);

  return { tracks, ...query };
}

/**
 * Fetch ALL liked tracks. Page-based pagination, shared promise.
 * Optional onPage callback fires per page during the fetch.
 */
let _allLikesPromise: Promise<Track[]> | null = null;

export function fetchAllLikedTracks(
  pageSize = 200,
  onPage?: (tracks: Track[]) => void,
): Promise<Track[]> {
  if (_allLikesPromise && !onPage) return _allLikesPromise;

  const promise = (async () => {
    const all: Track[] = [];
    for (let page = 0; ; page++) {
      const data = await api<TrackPage>(pagedUrl('/me/likes/tracks', page, pageSize));
      for (const t of data.collection) all.push(t);
      void rememberTracks(data.collection);
      onPage?.(data.collection);
      if (!data.has_more) break;
    }
    void rememberLikedTracks(all);
    return all;
  })();

  if (!onPage) {
    _allLikesPromise = promise;
    promise.catch(() => {
      _allLikesPromise = null;
    });
  }

  return promise;
}

export function invalidateAllLikesCache() {
  _allLikesPromise = null;
}

/* ── Fresh from followed artists ───────────────────────────────── */

export function useFollowingTracks(limit = 20) {
  return useQuery({
    queryKey: ['me', 'followings', 'tracks', limit],
    queryFn: () => api<TrackPage>(`/me/followings/tracks?limit=${limit}&page=0`),
    staleTime: SHORT_CACHE_MS,
    gcTime: INFINITE_GC_MS,
  });
}

/* ── Track Comments (infinite) ─────────────────────────────────── */

export function useTrackComments(trackUrn: string | undefined) {
  const query = usePagedQuery<Comment>({
    queryKey: ['track', trackUrn, 'comments'],
    url: (page, limit) =>
      pagedUrl(`/tracks/${encodeURIComponent(trackUrn!)}/comments`, page, limit),
    limit: 20,
    staleTime: SHORT_CACHE_MS,
    maxPages: 6,
    enabled: !!trackUrn,
  });

  return { comments: query.items, ...query };
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
      api<TrackPage>(`/tracks/${encodeURIComponent(trackUrn!)}/related?limit=${limit}&page=0`),
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
      api<PagedResponse<SCUser>>(
        `/tracks/${encodeURIComponent(trackUrn!)}/favoriters?limit=${limit}&page=0`,
      ),
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
  const query = usePagedQuery<Track>({
    queryKey: ['playlist', playlistUrn, 'tracks'],
    url: (page, limit) =>
      pagedUrl(`/playlists/${encodeURIComponent(playlistUrn!)}/tracks`, page, limit),
    limit: 200,
    staleTime: MEDIUM_CACHE_MS,
    enabled: !!playlistUrn,
    autoFetchAll: true,
  });

  return { tracks: query.items, ...query };
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
  const query = usePagedQuery<Track>({
    queryKey: ['user', userUrn, 'tracks'],
    url: (page, limit) =>
      pagedUrl(
        `/users/${encodeURIComponent(userUrn!)}/tracks`,
        page,
        limit,
        'access=playable,preview,blocked',
      ),
    limit: 30,
    staleTime: SHORT_CACHE_MS,
    maxPages: 8,
    enabled: !!userUrn,
    dedupe: (t) => t.urn,
  });

  return { tracks: query.items, ...query };
}

export function useUserPopularTracks(userUrn: string | undefined) {
  return useQuery({
    queryKey: ['user', userUrn, 'tracks', 'popular'],
    queryFn: async () => {
      const all: Track[] = [];
      const pageSize = 50;
      for (let page = 0; ; page++) {
        const data = await api<TrackPage>(
          pagedUrl(
            `/users/${encodeURIComponent(userUrn!)}/tracks`,
            page,
            pageSize,
            'access=playable,preview,blocked',
          ),
        );
        for (const t of data.collection) all.push(t);
        if (!data.has_more) break;
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
  const query = usePagedQuery<Playlist>({
    queryKey: ['user', userUrn, 'playlists'],
    url: (page, limit) => pagedUrl(`/users/${encodeURIComponent(userUrn!)}/playlists`, page, limit),
    limit: 30,
    staleTime: SHORT_CACHE_MS,
    maxPages: 8,
    enabled: !!userUrn,
    dedupe: (p) => p.urn,
  });

  return { playlists: query.items, ...query };
}

export function useUserLikedTracks(userUrn: string | undefined) {
  const query = usePagedQuery<Track>({
    queryKey: ['user', userUrn, 'likes', 'tracks'],
    url: (page, limit) =>
      pagedUrl(
        `/users/${encodeURIComponent(userUrn!)}/likes/tracks`,
        page,
        limit,
        'access=playable,preview,blocked',
      ),
    limit: 30,
    staleTime: SHORT_CACHE_MS,
    maxPages: 8,
    enabled: !!userUrn,
    dedupe: (t) => t.urn,
  });

  return { tracks: query.items, ...query };
}

export function useUserFollowings(userUrn: string | undefined) {
  const query = usePagedQuery<SCUser>({
    queryKey: ['user', userUrn, 'followings'],
    url: (page, limit) =>
      pagedUrl(`/users/${encodeURIComponent(userUrn!)}/followings`, page, limit),
    limit: 30,
    staleTime: SHORT_CACHE_MS,
    maxPages: 8,
    enabled: !!userUrn,
    dedupe: (u) => u.urn,
  });

  return { users: query.items, ...query };
}

export function useUserFollowers(userUrn: string | undefined) {
  const query = usePagedQuery<SCUser>({
    queryKey: ['user', userUrn, 'followers'],
    url: (page, limit) => pagedUrl(`/users/${encodeURIComponent(userUrn!)}/followers`, page, limit),
    limit: 30,
    staleTime: SHORT_CACHE_MS,
    maxPages: 8,
    enabled: !!userUrn,
    dedupe: (u) => u.urn,
  });

  return { users: query.items, ...query };
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

export function useUserSubscription(userUrn: string | undefined) {
  return useQuery({
    queryKey: ['user', userUrn, 'subscription'],
    queryFn: () => api<{ premium: boolean }>(`/users/${encodeURIComponent(userUrn!)}/subscription`),
    enabled: !!userUrn,
    staleTime: MEDIUM_CACHE_MS,
    gcTime: INFINITE_GC_MS,
    select: (d) => d.premium,
  });
}

/* ── My Library ────────────────────────────────────────────────── */

export function useMyFollowings(limit = 30) {
  const query = usePagedQuery<SCUser>({
    queryKey: ['me', 'followings', limit],
    url: (page, l) => pagedUrl('/me/followings', page, l),
    limit,
  });

  return { users: query.items, ...query };
}

export function useMyLikedPlaylists(limit = 30) {
  const query = usePagedQuery<Playlist>({
    queryKey: ['me', 'likes', 'playlists', limit],
    url: (page, l) => pagedUrl('/me/likes/playlists', page, l),
    limit,
  });

  return { playlists: query.items, ...query };
}

export function useMyPlaylists(limit = 30) {
  const query = usePagedQuery<Playlist>({
    queryKey: ['me', 'playlists', limit],
    url: (page, l) => pagedUrl('/me/playlists', page, l),
    limit,
  });

  return { playlists: query.items, ...query };
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
  const query = usePagedQuery<Track>({
    queryKey: ['search', 'tracks', q],
    url: (page, limit) => pagedUrl('/tracks', page, limit, `q=${encodeURIComponent(q)}`),
    limit: 20,
    staleTime: SEARCH_CACHE_MS,
    maxPages: 5,
    enabled: !!q.trim(),
    dedupe: (t) => t.urn,
  });

  return { tracks: query.items, ...query };
}

export function useSearchPlaylists(q: string) {
  const query = usePagedQuery<Playlist>({
    queryKey: ['search', 'playlists', q],
    url: (page, limit) => pagedUrl('/playlists', page, limit, `q=${encodeURIComponent(q)}`),
    limit: 20,
    staleTime: SEARCH_CACHE_MS,
    maxPages: 5,
    enabled: !!q.trim(),
    dedupe: (p) => p.urn,
  });

  return { playlists: query.items, ...query };
}

export function useSearchUsers(q: string) {
  const query = usePagedQuery<SCUser>({
    queryKey: ['search', 'users', q],
    url: (page, limit) => pagedUrl('/users', page, limit, `q=${encodeURIComponent(q)}`),
    limit: 20,
    staleTime: SEARCH_CACHE_MS,
    maxPages: 5,
    enabled: !!q.trim(),
    dedupe: (u) => u.urn,
  });

  return { users: query.items, ...query };
}

/* ── Fallback / Seed Tracks ────────────────────────────────────── */

const FALLBACK_TRACK_IDS = '2028682452,2065341288,2028677636,2209249766,2060818444,2064016848';

export function useFallbackTracks() {
  return useQuery({
    queryKey: ['fallback', 'tracks'],
    queryFn: () => api<TrackPage>(`/tracks?ids=${FALLBACK_TRACK_IDS}&page=0&limit=30`),
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
  // Stable seed — compute once when liked tracks first arrive, don't recompute on likes
  const seedRef = useRef<string[]>([]);
  if (seedRef.current.length === 0 && likedTracks.length > 0) {
    seedRef.current = sampleTrackUrns(likedTracks, 30);
  }
  const seedUrns = seedRef.current;

  const likedUrns = useMemo(() => new Set(likedTracks.map((t) => t.urn)), [likedTracks]);

  return useQuery({
    queryKey: ['discover', 'related-pool', seedUrns],
    queryFn: async () => {
      const results = await Promise.all(
        seedUrns.map((urn) =>
          api<TrackPage>(`/tracks/${encodeURIComponent(urn)}/related?limit=20&page=0`).catch(
            () =>
              ({ collection: [] as Track[], page: 0, page_size: 20, has_more: false }) as TrackPage,
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

    const byGenre = new Map<string, { count: number; track: Track }[]>();
    for (const entry of pool.values()) {
      const g = entry.track.genre?.trim().toLowerCase();
      if (!g) continue;
      const arr = byGenre.get(g);
      if (arr) arr.push(entry);
      else byGenre.set(g, [entry]);
    }

    for (const arr of byGenre.values()) {
      arr.sort((a, b) => b.count - a.count);
    }

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
