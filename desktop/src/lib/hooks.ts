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
import {
  aggregateRelatedCandidates,
  buildDiscoverGenreGroups,
  type DiscoverRankOptions,
  type DiscoverRelatedCandidate,
  rankDiscoverCandidates,
  selectDiscoverSeeds,
} from './discover-recommendations';
import { isUrnDisliked, useDislikeVersion } from './dislikes';
import { recordEvent } from './events';
import {
  curateHomeRecommendations,
  type HomeRecommendationFeedback,
  type HomeRecommendationInput,
  type HomeRecommendationMode,
  recommendationTrackFromInput,
} from './home-recommendations';
import { initLikedUrns } from './likes';
import { rememberLikedTracks, rememberTracks } from './offline-index';
import { fetchRelatedTracks } from './related';

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
  kind?: 'playlist' | 'album' | 'ep' | 'single' | 'compilation';
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
  likes_count?: number;
  repost_count?: number;
  release_year?: number;
  release_date?: string;
  label_name?: string;
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
    permalink_url?: string;
    followers_count?: number;
    track_count?: number;
  };
}

export interface SCUser {
  id: number;
  urn: string;
  username: string;
  avatar_url: string;
  permalink_url?: string;
  followers_count?: number;
  followings_count?: number;
  track_count?: number;
  city?: string | null;
  /// Backend now emits `country_code` (ISO-2). Legacy `country` оставляем
  /// для совместимости со старыми payload'ами SC.
  country_code?: string | null;
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
const RELATED_POOL_SEEDS = 8;
const RELATED_POOL_CONCURRENCY = 3;

/**
 * Cold-эндпоинты (треки/плейлисты/лайки/фолловинги юзеров, /me/*) живут в
 * нашей БД и обновляются бэком SWR-cron'ом без участия фронта. tanstack-query
 * не должен сам дёргать refetch на каждый mount — бэк всё равно отдаст cold
 * копию мгновенно. Полагаемся на явные invalidate'ы из мутаций
 * (like/unlike/follow/playlist updates).
 */
const COLD_CACHE_MS = Number.POSITIVE_INFINITY;

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
    queryFn: ({ pageParam, signal }) =>
      api<PagedResponse<T>>(opts.url(pageParam, limit), { signal }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.has_more ? last.page + 1 : undefined),
    staleTime: opts.staleTime,
    gcTime: opts.gcTime ?? INFINITE_GC_MS,
    maxPages: opts.maxPages,
    enabled: opts.enabled,
    // Списки рефрешатся только явными invalidate'ами из мутаций. Remount/
    // reconnect не должен перетягивать весь infinite-query: для SC cursor-лент
    // это перепроходит сдвинувшийся курсор и тасует выдачу. Focus-рефетч уже
    // выключен глобально в query-client.
    refetchOnMount: false,
    refetchOnReconnect: false,
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

export function useHistory(limit = 50, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: ['history'],
    queryFn: ({ pageParam = 0, signal }) => {
      return api<{ collection: HistoryEntry[]; total: number }>(
        `/history?limit=${limit}&offset=${pageParam}`,
        { signal },
      );
    },
    initialPageParam: 0,
    gcTime: INFINITE_GC_MS,
    maxPages: 8,
    getNextPageParam: (last, _all, lastOffset) => {
      const nextOffset = (lastOffset as number) + limit;
      return nextOffset < last.total ? nextOffset : undefined;
    },
    staleTime: 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    enabled,
  });

  const entries = useMemo(() => flattenCollectionPages(query.data?.pages), [query.data]);

  return { entries, ...query };
}

/* ── Featured ─────────────────────────────────────────────────── */

export interface FeaturedResponse {
  type: 'track' | 'playlist' | 'user';
  data: any;
}

export function useFeatured() {
  return useQuery<FeaturedResponse | null>({
    queryKey: ['featured'],
    queryFn: ({ signal }) => api<FeaturedResponse | null>('/featured', { signal }),
    staleTime: 5 * 60_000,
  });
}

/* ── Liked tracks ──────────────────────────────────────────────── */

export function useLikedTracks(limit = 30, enabled = true) {
  const query = usePagedQuery<Track>({
    queryKey: ['me', 'likes', 'tracks', limit],
    url: (page, l) => pagedUrl('/me/likes/tracks', page, l),
    limit,
    staleTime: COLD_CACHE_MS,
    enabled,
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

/** Все треки плейлиста, по страницам до конца — под shuffle-continuation. */
export function fetchAllPlaylistTracks(playlistUrn: string, pageSize = 200): Promise<Track[]> {
  return (async () => {
    const all: Track[] = [];
    const base = `/playlists/${encodeURIComponent(playlistUrn)}/tracks`;
    for (let page = 0; ; page++) {
      const data = await api<TrackPage>(pagedUrl(base, page, pageSize));
      for (const t of data.collection) all.push(t);
      void rememberTracks(data.collection);
      if (!data.has_more) break;
    }
    return all;
  })();
}

/* ── Fresh from followed artists ───────────────────────────────── */

export function useFollowingTracks(limit = 20) {
  return useQuery({
    queryKey: ['me', 'followings', 'tracks', limit],
    queryFn: ({ signal }) =>
      api<TrackPage>(`/me/followings/tracks?limit=${limit}&page=0`, { signal }),
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
    queryFn: ({ signal }) => fetchRelatedTracks(trackUrn!, limit, 0, signal),
    enabled: !!trackUrn,
    staleTime: SHORT_CACHE_MS,
    gcTime: INFINITE_GC_MS,
  });
}

/* ── Track Favoriters ─────────────────────────────────────────── */

export function useTrackFavoriters(trackUrn: string | undefined, limit = 12) {
  return useQuery({
    queryKey: ['track', trackUrn, 'favoriters', limit],
    queryFn: ({ signal }) =>
      api<PagedResponse<SCUser>>(
        `/tracks/${encodeURIComponent(trackUrn!)}/favoriters?limit=${limit}&page=0`,
        { signal },
      ),
    enabled: !!trackUrn,
    staleTime: SHORT_CACHE_MS,
    gcTime: INFINITE_GC_MS,
  });
}

/* ── Playlist Detail (cold) ───────────────────────────────────── */

export function usePlaylist(playlistUrn: string | undefined) {
  return useQuery({
    queryKey: ['playlist', playlistUrn],
    queryFn: ({ signal }) =>
      api<Playlist>(`/playlists/${encodeURIComponent(playlistUrn!)}`, { signal }),
    enabled: !!playlistUrn,
    staleTime: COLD_CACHE_MS,
    gcTime: INFINITE_GC_MS,
  });
}

/* ── Playlist Tracks (cold) ───────────────────────────────────── */

export function usePlaylistTracks(playlistUrn: string | undefined) {
  const query = usePagedQuery<Track>({
    queryKey: ['playlist', playlistUrn, 'tracks'],
    url: (page, limit) =>
      pagedUrl(`/playlists/${encodeURIComponent(playlistUrn!)}/tracks`, page, limit),
    limit: 200,
    staleTime: COLD_CACHE_MS,
    enabled: !!playlistUrn,
    autoFetchAll: true,
  });

  return { tracks: query.items, ...query };
}

/* ── User Profile (cold) ──────────────────────────────────────── */

export function useUser(userUrn: string | undefined) {
  return useQuery({
    queryKey: ['user', userUrn],
    queryFn: ({ signal }) => api<UserProfile>(`/users/${encodeURIComponent(userUrn!)}`, { signal }),
    enabled: !!userUrn,
    staleTime: COLD_CACHE_MS,
    gcTime: INFINITE_GC_MS,
  });
}

export function useUserTracks(userUrn: string | undefined) {
  const query = usePagedQuery<Track>({
    queryKey: ['user', userUrn, 'tracks'],
    url: (page, limit) => pagedUrl(`/users/${encodeURIComponent(userUrn!)}/tracks`, page, limit),
    limit: 30,
    // НЕ cold-infinite: owned-треки переупорядочиваются при новых загрузках
    // артиста, а клиентской мутации (как у like/follow) тут нет — некому слать
    // invalidate. Финитный stale → ремоунт подтянет свежий порядок с бэка.
    staleTime: MEDIUM_CACHE_MS,
    maxPages: 8,
    enabled: !!userUrn,
    dedupe: (t) => t.urn,
  });

  return { tracks: query.items, ...query };
}

export function useUserPopularTracks(userUrn: string | undefined) {
  return useQuery({
    queryKey: ['user', userUrn, 'tracks', 'popular'],
    queryFn: async ({ signal }) => {
      const all: Track[] = [];
      const pageSize = 100;
      for (let page = 0; ; page++) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const data = await api<TrackPage>(
          pagedUrl(`/users/${encodeURIComponent(userUrn!)}/tracks`, page, pageSize),
          { signal },
        );
        for (const t of data.collection) all.push(t);
        if (!data.has_more) break;
      }
      all.sort((a, b) => (b.playback_count ?? 0) - (a.playback_count ?? 0));
      return all;
    },
    enabled: !!userUrn,
    staleTime: COLD_CACHE_MS,
    gcTime: INFINITE_GC_MS,
  });
}

export function useUserPlaylists(userUrn: string | undefined) {
  const query = usePagedQuery<Playlist>({
    queryKey: ['user', userUrn, 'playlists'],
    url: (page, limit) => pagedUrl(`/users/${encodeURIComponent(userUrn!)}/playlists`, page, limit),
    limit: 30,
    staleTime: COLD_CACHE_MS,
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
      pagedUrl(`/users/${encodeURIComponent(userUrn!)}/likes/tracks`, page, limit),
    limit: 30,
    staleTime: COLD_CACHE_MS,
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
    staleTime: COLD_CACHE_MS,
    maxPages: 8,
    enabled: !!userUrn,
    dedupe: (u) => u.urn,
  });

  return { users: query.items, ...query };
}

/* `/users/{urn}/followers` остался горячим на бэке (входящих подписчиков мы не
 * храним как сущность) — короткий staleTime, как раньше. */
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
    queryFn: ({ signal }) =>
      api<WebProfile[]>(`/users/${encodeURIComponent(userUrn!)}/web-profiles`, { signal }),
    enabled: !!userUrn,
    staleTime: MEDIUM_CACHE_MS,
    gcTime: INFINITE_GC_MS,
  });
}

/* ── My Library (cold) ─────────────────────────────────────────── */

export function useMyFollowings(limit = 30) {
  const query = usePagedQuery<SCUser>({
    queryKey: ['me', 'followings', limit],
    url: (page, l) => pagedUrl('/me/followings', page, l),
    limit,
    staleTime: COLD_CACHE_MS,
  });

  return { users: query.items, ...query };
}

export function useMyLikedPlaylists(limit = 30) {
  const query = usePagedQuery<Playlist>({
    queryKey: ['me', 'likes', 'playlists', limit],
    url: (page, l) => pagedUrl('/me/likes/playlists', page, l),
    limit,
    staleTime: COLD_CACHE_MS,
  });

  return { playlists: query.items, ...query };
}

export function useMyPlaylists(limit = 30) {
  const query = usePagedQuery<Playlist>({
    queryKey: ['me', 'playlists', limit],
    url: (page, l) => pagedUrl('/me/playlists', page, l),
    limit,
    staleTime: COLD_CACHE_MS,
  });

  return { playlists: query.items, ...query };
}

/* ── Playlist Mutations ────────────────────────────────────────── */

// Полная перестановка/удаление из свежей загруженной вью — шлём `{order}`-дельту
// (а не PUT всего списка): backend применяет к desired-state и пушит в SC фоном.
export function useUpdatePlaylistTracks(playlistUrn: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trackUrns: string[]) =>
      api(`/playlists/${encodeURIComponent(playlistUrn!)}/tracks`, {
        method: 'POST',
        body: JSON.stringify({ order: trackUrns }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['playlist', playlistUrn] });
      qc.invalidateQueries({ queryKey: ['playlist', playlistUrn, 'tracks'] });
      qc.invalidateQueries({ queryKey: ['me', 'playlists'] });
    },
  });
}

// Добавление — `{add}`-дельты (по одной на трек). Backend дедупит и считает
// дельту против сохранённого desired-state, поэтому устаревшая клиентская вью
// НЕ может уронить уже лежащие треки (прежний full-list PUT мог).
export function useAddToPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playlistUrn,
      trackUrns,
    }: {
      playlistUrn: string;
      trackUrns: string[];
    }) => {
      let last: unknown;
      for (const urn of trackUrns) {
        last = await api(`/playlists/${encodeURIComponent(playlistUrn)}/tracks`, {
          method: 'POST',
          body: JSON.stringify({ add: urn }),
        });
        recordEvent('playlist_add', urn);
      }
      return last;
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
    mutationFn: async (params: {
      title: string;
      sharing?: 'public' | 'private';
      trackUrns?: string[];
    }) => {
      const playlist = await api<Playlist>('/playlists', {
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
      });
      for (const urn of params.trackUrns ?? []) recordEvent('playlist_add', urn);
      return playlist;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'playlists'] });
    },
  });
}

/* ── Sharing (privacy) ─────────────────────────────────────────── */

/** Тоггл приватности своего плейлиста. Optimistic: бэк сразу обновляет наш
 *  `sharing` + кладёт write-back в SC через sync_queue. */
export function useSetPlaylistSharing(playlistUrn: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sharing: 'public' | 'private') =>
      api(`/playlists/${encodeURIComponent(playlistUrn!)}/sharing`, {
        method: 'PUT',
        body: JSON.stringify({ sharing }),
      }),
    onSuccess: (_data, sharing) => {
      qc.setQueryData<Playlist>(['playlist', playlistUrn], (old) =>
        old ? { ...old, sharing } : old,
      );
      qc.invalidateQueries({ queryKey: ['playlist', playlistUrn] });
      qc.invalidateQueries({ queryKey: ['me', 'playlists'] });
      // Список своих плейлистов на профиле — ['user', urn, 'playlists'].
      qc.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

/** Тоггл приватности своего трека. */
export function useSetTrackSharing(trackUrn: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sharing: 'public' | 'private') =>
      api(`/tracks/${encodeURIComponent(trackUrn!)}/sharing`, {
        method: 'PUT',
        body: JSON.stringify({ sharing }),
      }),
    onSuccess: (_data, sharing) => {
      qc.setQueryData<Track>(['track', trackUrn], (old) => (old ? { ...old, sharing } : old));
      qc.invalidateQueries({ queryKey: ['track', trackUrn], exact: true });
      // Списки своих треков на профиле — ['user', urn, 'tracks'] (нет ['me','tracks']).
      qc.invalidateQueries({ queryKey: ['user'] });
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

/* ── Search: SCD-DB ───────────────────────────────────────────── */

/**
 * Поиск в нашей базе (зеркало SoundCloud). Возвращает только то, что мы уже
 * индексировали — но без сетевого fan-out'а в SC API, поэтому в разы быстрее.
 * Бэк зашит на trgm-индексы + statement_timeout, фронту достаточно поднести
 * `q` и опционально `userUrn` для скоупа.
 */

const SEARCH_DB_LIMIT = 20;
const SEARCH_DB_MAX_PAGES = 10;

export function useSearchDbTracks(q: string, userUrn?: string) {
  const query = usePagedQuery<Track>({
    queryKey: ['search', 'db', 'tracks', q, userUrn ?? ''],
    url: (page, limit) =>
      pagedUrl(
        '/search/db/tracks',
        page,
        limit,
        `q=${encodeURIComponent(q)}${userUrn ? `&user_urn=${encodeURIComponent(userUrn)}` : ''}`,
      ),
    limit: SEARCH_DB_LIMIT,
    staleTime: SEARCH_CACHE_MS,
    maxPages: SEARCH_DB_MAX_PAGES,
    enabled: !!q.trim(),
    dedupe: (t) => t.urn,
  });
  return { tracks: query.items, ...query };
}

export function useSearchDbPlaylists(q: string, userUrn?: string) {
  const query = usePagedQuery<Playlist>({
    queryKey: ['search', 'db', 'playlists', q, userUrn ?? ''],
    url: (page, limit) =>
      pagedUrl(
        '/search/db/playlists',
        page,
        limit,
        `q=${encodeURIComponent(q)}${userUrn ? `&user_urn=${encodeURIComponent(userUrn)}` : ''}`,
      ),
    limit: SEARCH_DB_LIMIT,
    staleTime: SEARCH_CACHE_MS,
    maxPages: SEARCH_DB_MAX_PAGES,
    enabled: !!q.trim(),
    dedupe: (p) => p.urn,
  });
  return { playlists: query.items, ...query };
}

export function useSearchDbUsers(q: string) {
  const query = usePagedQuery<SCUser>({
    queryKey: ['search', 'db', 'users', q],
    url: (page, limit) => pagedUrl('/search/db/users', page, limit, `q=${encodeURIComponent(q)}`),
    limit: SEARCH_DB_LIMIT,
    staleTime: SEARCH_CACHE_MS,
    maxPages: SEARCH_DB_MAX_PAGES,
    enabled: !!q.trim(),
    dedupe: (u) => u.urn,
  });
  return { users: query.items, ...query };
}

export function useSearchDbArtists(q: string) {
  const query = usePagedQuery<import('./discover').CatalogArtist>({
    queryKey: ['search', 'db', 'artists', q],
    url: (page, limit) => pagedUrl('/search/db/artists', page, limit, `q=${encodeURIComponent(q)}`),
    limit: SEARCH_DB_LIMIT,
    staleTime: SEARCH_CACHE_MS,
    maxPages: SEARCH_DB_MAX_PAGES,
    enabled: !!q.trim(),
    dedupe: (a) => a.id,
  });
  return { artists: query.items, ...query };
}

export function useSearchDbAlbums(q: string) {
  const query = usePagedQuery<import('./discover').CatalogAlbum>({
    queryKey: ['search', 'db', 'albums', q],
    url: (page, limit) => pagedUrl('/search/db/albums', page, limit, `q=${encodeURIComponent(q)}`),
    limit: SEARCH_DB_LIMIT,
    staleTime: SEARCH_CACHE_MS,
    maxPages: SEARCH_DB_MAX_PAGES,
    enabled: !!q.trim(),
    dedupe: (a) => a.id,
  });
  return { albums: query.items, ...query };
}

/* ── Search: Vibe + Lyrics (AI) ───────────────────────────────── */

const EMPTY_TRACKS: Track[] = [];
const EMPTY_ATMOSPHERE: SearchAtmosphere = { topGenres: [] };

export interface SearchAtmosphere {
  /** Dominant genres of the result set — used to tint the page atmosphere. */
  topGenres: string[];
}

export interface VibeSearchResponse {
  items: Track[];
  atmosphere: SearchAtmosphere;
  /** "preparing" = the query vector is still being computed by the worker
   *  (high load); items is empty, the UI shows a "preparing vibe" plaque and
   *  this query auto-refetches until it flips to "ready". */
  status?: 'ready' | 'preparing';
}

/**
 * Semantic "by vibe" search. Backend encodes the query (MuLan→CLAP, cached) and
 * returns SC-shaped tracks in similarity order plus an `atmosphere` hint
 * (dominant genres) the UI uses to recolour the page.
 */
export function useVibeSearch(q: string, opts?: { limit?: number; languages?: string[] }) {
  const limit = opts?.limit ?? 48;
  const langs = (opts?.languages ?? []).slice().sort().join(',');
  const query = useQuery<VibeSearchResponse>({
    queryKey: ['search', 'vibe', q, limit, langs],
    enabled: q.trim().length >= 2,
    staleTime: SEARCH_CACHE_MS,
    // While the worker is encoding, use bounded backoff. An overloaded backend
    // must not leave a hidden 2.5s poll running forever.
    refetchInterval: (q2) => {
      if (q2.state.data?.status !== 'preparing') return false;
      const attempts = q2.state.dataUpdateCount;
      if (attempts >= 7) return false;
      return Math.min(2_500 + Math.max(0, attempts - 1) * 1_500, 10_000);
    },
    queryFn: ({ signal }) => {
      const usp = new URLSearchParams({ q: q.trim(), limit: String(limit) });
      if (langs) usp.set('languages', langs);
      return api<VibeSearchResponse>(`/search/vibe?${usp}`, { signal }, 30_000);
    },
  });
  return {
    tracks: query.data?.items ?? EMPTY_TRACKS,
    atmosphere: query.data?.atmosphere ?? EMPTY_ATMOSPHERE,
    preparing: query.data?.status === 'preparing',
    ...query,
  };
}

export type LyricMode = 'text' | 'semantic' | 'auto';

export interface LyricHit {
  track: Track;
  /** The matched lyric line (text mode); null for pure semantic hits. */
  matchedLine: string | null;
  score: number;
}

/**
 * Lyric search. `text` = keyword match over stored lyrics (returns the matched
 * line); `semantic` = lyric-embedding similarity; `auto` = both, merged.
 */
export function useLyricSearch(q: string, mode: LyricMode = 'auto') {
  const query = usePagedQuery<LyricHit>({
    queryKey: ['search', 'lyrics', q, mode],
    url: (page, limit) =>
      pagedUrl('/search/lyrics', page, limit, `q=${encodeURIComponent(q)}&mode=${mode}`),
    limit: SEARCH_DB_LIMIT,
    staleTime: SEARCH_CACHE_MS,
    maxPages: SEARCH_DB_MAX_PAGES,
    enabled: q.trim().length >= 2,
    dedupe: (h) => h.track.urn,
  });
  return { hits: query.items, ...query };
}

/* ── Fallback / Seed Tracks ────────────────────────────────────── */

const FALLBACK_TRACK_IDS = '2028682452,2065341288,2028677636,2209249766,2060818444,2064016848';

export function useFallbackTracks() {
  return useQuery({
    queryKey: ['fallback', 'tracks'],
    queryFn: ({ signal }) =>
      api<TrackPage>(`/tracks?ids=${FALLBACK_TRACK_IDS}&page=0&limit=30`, { signal }),
    staleTime: 1000 * 60 * 30,
  });
}

/* ── Discover ──────────────────────────────────────────────────── */

type RelatedPool = DiscoverRelatedCandidate[];

/**
 * Related fallback for backends without cluster candidates. Seeds are stable
 * and taste-stratified; fan-out stays deliberately below browser connection
 * pressure and only runs when the primary cluster response is unavailable.
 */
export function useRelatedPool(
  likedTracks: readonly Track[],
  recentTracks: readonly Track[] = EMPTY_TRACKS,
  enabled = true,
) {
  const dislikeVersion = useDislikeVersion();
  const blockedSeedUrns = useMemo(() => {
    void dislikeVersion;
    const blocked = new Set<string>();
    for (const track of [...recentTracks, ...likedTracks]) {
      if (isUrnDisliked(track.urn)) blocked.add(track.urn);
    }
    return blocked;
  }, [dislikeVersion, likedTracks, recentTracks]);
  const seeds = useMemo(
    () =>
      selectDiscoverSeeds(likedTracks, recentTracks, {
        limit: RELATED_POOL_SEEDS,
        blockedUrns: blockedSeedUrns,
      }),
    [blockedSeedUrns, likedTracks, recentTracks],
  );
  const seedUrns = useMemo(() => seeds.map((track) => track.urn), [seeds]);

  return useQuery<RelatedPool>({
    queryKey: ['discover', 'related-pool', seedUrns],
    queryFn: async ({ signal }) => {
      const results: TrackPage[] = new Array(seedUrns.length);
      let successfulRequests = 0;
      let cursor = 0;
      const worker = async () => {
        while (cursor < seedUrns.length) {
          if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
          const index = cursor++;
          try {
            results[index] = await fetchRelatedTracks(seedUrns[index], 20, 0, signal);
            successfulRequests += 1;
          } catch (error) {
            if (signal.aborted) throw error;
            results[index] = { collection: [], page: 0, page_size: 20, has_more: false };
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(RELATED_POOL_CONCURRENCY, seedUrns.length) }, () => worker()),
      );
      if (successfulRequests === 0 && seedUrns.length > 0) {
        throw new Error('all related recommendation requests failed');
      }
      return aggregateRelatedCandidates(results.map((result) => result?.collection ?? []));
    },
    enabled: enabled && seedUrns.length > 0,
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 30,
  });
}

/** Weighted related tracks with hard eligibility filters and artist-aware MMR. */
export function useRecommendedTracks(
  pool: RelatedPool | undefined,
  limit = 40,
  options: Omit<DiscoverRankOptions, 'limit'> = {},
) {
  const { blockedUrns, excludedUrns, mode } = options;
  return useMemo(
    () =>
      rankDiscoverCandidates(pool ?? [], {
        blockedUrns,
        excludedUrns,
        mode,
        limit,
      }),
    [blockedUrns, excludedUrns, limit, mode, pool],
  );
}

/** Evidence-ranked genre groups, including adjacent genres absent from likes. */
export function useDiscoverData(rankedTracks: readonly Track[], likedTracks: readonly Track[]) {
  return useMemo(
    () => buildDiscoverGenreGroups(rankedTracks, likedTracks),
    [likedTracks, rankedTracks],
  );
}

export interface DiscoverFeedOptions {
  primaryCandidates?: readonly HomeRecommendationInput[];
  primaryLoading?: boolean;
  recentTracks?: readonly Track[];
  mode?: HomeRecommendationMode;
  feedback?: HomeRecommendationFeedback;
}

/**
 * Shared Discover feed. Hydrated cluster candidates are the primary source;
 * the bounded related fan-out only starts after that source resolves empty.
 */
export function useDiscoverFeed(options: DiscoverFeedOptions = {}) {
  const dislikeVersion = useDislikeVersion();
  const likedQuery = useLikedTracks(100);
  const likedTracks = likedQuery.tracks;
  const recentTracks: readonly Track[] = options.recentTracks ?? EMPTY_TRACKS;
  const primaryCandidates: readonly HomeRecommendationInput[] =
    options.primaryCandidates ?? EMPTY_TRACKS;
  const mode = options.mode ?? 'similar';
  const excludedUrns = useMemo(
    () => new Set([...likedTracks, ...recentTracks].map((track) => track.urn)),
    [likedTracks, recentTracks],
  );
  const primaryTracks = useMemo(
    () => primaryCandidates.map(recommendationTrackFromInput),
    [primaryCandidates],
  );
  const primaryBlockedUrns = useMemo(
    () => {
      void dislikeVersion;
      return new Set(
        primaryTracks.filter((track) => isUrnDisliked(track.urn)).map((track) => track.urn),
      );
    },
    [dislikeVersion, primaryTracks],
  );
  const primary = useMemo(
    () =>
      curateHomeRecommendations(primaryCandidates, {
        excludedUrns,
        blockedUrns: primaryBlockedUrns,
        likedTracks,
        recentTracks,
        mode,
        feedback: options.feedback,
        limit: 60,
      }).filter((track) => !excludedUrns.has(track.urn)),
    [
      excludedUrns,
      likedTracks,
      mode,
      options.feedback,
      primaryBlockedUrns,
      primaryCandidates,
      recentTracks,
    ],
  );
  const primaryLoading = options.primaryLoading === true;
  const relatedQuery = useRelatedPool(
    likedTracks,
    recentTracks,
    !primaryLoading && primary.length === 0,
  );
  const fallbackBlockedUrns = useMemo(
    () => {
      void dislikeVersion;
      return new Set(
        (relatedQuery.data ?? [])
          .map((candidate) => candidate.track)
          .filter((track) => isUrnDisliked(track.urn))
          .map((track) => track.urn),
      );
    },
    [dislikeVersion, relatedQuery.data],
  );
  const fallback = useRecommendedTracks(relatedQuery.data, 60, {
    excludedUrns,
    blockedUrns: fallbackBlockedUrns,
    mode,
  });
  const recommended = primary.length > 0 ? primary : fallback;
  const byGenre = useDiscoverData(recommended, likedTracks);
  const isLoading =
    likedQuery.isLoading ||
    primaryLoading ||
    (primary.length === 0 && relatedQuery.isLoading);

  return {
    likedTracks,
    isLoading,
    recommended,
    byGenre,
    source: primary.length > 0 ? ('clusters' as const) : ('related' as const),
  };
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
