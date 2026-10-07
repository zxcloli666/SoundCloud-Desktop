import {
  type DefaultError,
  type InfiniteData,
  type QueryKey,
  useInfiniteQuery,
  type UseInfiniteQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {useEffect, useMemo, useRef} from 'react';
import {useAuthStore} from '../stores/auth';
import type {Track} from '../stores/player';
import {useSettingsStore} from '../stores/settings';
import {api, isRefreshPending} from './api';
import type {ApiRequestOptions} from './api-client';
import {
  type CollectionSync,
  type CollectionSyncState,
  isPartialSync,
  useCollectionSync,
} from './collection-sync';
import type {LikedSnapshot} from './liked-merge';
import {initLikedUrns} from './likes';
import {rememberLikedTracks, rememberTracks} from './offline-index';
import {
  editPlaylistTracks,
  type PlaylistDetails,
  toastPlaylistEditError,
  updatePlaylistDetails,
} from './playlist-edits';
import {fetchRelatedTracks} from './related';
import {
  deleteTrack,
  type TrackDetails,
  toastTrackEditError,
  updateTrackDetails,
} from './track-edits';

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
  sync?: CollectionSync;
}

type TrackPage = PagedResponse<Track>;

export interface PlaylistSync extends CollectionSync {
  lastOperationSequence: number;
  projectionTrackCount: number;
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
  country_code?: string | null;
}

export interface UserProfile extends SCUser {
  permalink: string;
  created_at: string;
  last_modified: string;
  first_name: string;
  last_name: string;
  full_name: string;
  description: string | null;
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
const INFINITE_GC_MS = 1000 * 60 * 3;
const COLD_CACHE_MS = Number.POSITIVE_INFINITY;
const PARTIAL_REFETCH_MS = 30_000;
const PARTIAL_REFETCH_LIMIT = 20;
const REFRESH_PENDING_RETRIES = 8;
const QUEUED_CREATE_REFRESH_MS = [3_000, 10_000, 30_000];

export const retryWhileRefreshing = {
  retry: (failureCount: number, error: unknown) =>
    failureCount < (isRefreshPending(error) ? REFRESH_PENDING_RETRIES : 1),
  retryDelay: (failureCount: number, error: unknown) =>
    isRefreshPending(error)
      ? Math.min(Math.max(error.retryAfterSeconds ?? 5, 3), 30) * 1000
      : Math.min(1000 * 2 ** failureCount, 30_000),
};

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

function urnOf(item: { urn: string }): string {
  return item.urn;
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
  timeoutMs?: number;
  /** Auto-fetch all pages until exhausted. Use sparingly. */
  autoFetchAll?: boolean;
  dedupe?: (item: T) => string;
  request?: ApiRequestOptions;
  retry?: (failureCount: number, error: Error) => boolean;
  retryDelay?: (failureCount: number, error: Error) => number;
}

export type PagedQueryResult<T> = UseInfiniteQueryResult<
  InfiniteData<PagedResponse<T>, number>,
  DefaultError
> & { items: T[]; syncState: CollectionSyncState };

/**
 * Унифицированный page-based useInfiniteQuery helper. Бэк отдаёт
 * { collection, page, page_size, has_more } — этого достаточно для пагинации.
 */
export function usePagedQuery<T>(opts: PagedQueryOptions<T>): PagedQueryResult<T> {
  const limit = opts.limit ?? 30;
  const query = useInfiniteQuery<
    PagedResponse<T>,
    DefaultError,
    InfiniteData<PagedResponse<T>, number>,
    QueryKey,
    number
  >({
    queryKey: opts.queryKey,
    queryFn: ({ pageParam }) =>
      api<PagedResponse<T>>(opts.url(pageParam, limit), opts.request, opts.timeoutMs),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.has_more ? last.page + 1 : undefined),
    staleTime: opts.staleTime,
    gcTime: opts.gcTime ?? INFINITE_GC_MS,
    maxPages: opts.maxPages,
    enabled: opts.enabled,
    retry: opts.retry,
    retryDelay: opts.retryDelay,
    // Списки рефрешатся только явными invalidate'ами из мутаций. Remount/
    // reconnect не должен перетягивать весь infinite-query: для SC cursor-лент
    // это перепроходит сдвинувшийся курсор и тасует выдачу. Focus-рефетч уже
    // выключен глобально в query-client.
    refetchOnMount: (query) => query.state.isInvalidated,
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

  const syncState = useCollectionSync(
    opts.queryKey,
    opts.url(0, 1),
    query.data?.pages[0],
    query.dataUpdatedAt,
  );

  return Object.assign(query, { items, syncState }) as PagedQueryResult<T>;
}

export function pagedUrl(base: string, page: number, limit: number, extra?: string): string {
  const sep = base.includes('?') ? '&' : '?';
  const params = `limit=${limit}&page=${page}${extra ? `&${extra}` : ''}`;
  return `${base}${sep}${params}`;
}

/* ── History ───────────────────────────────────────────────────── */

export interface HistoryEntry {
  id: string;
  trackUrn: string;
  title: string;
  artistName: string;
  artistUrn: string | null;
  artworkUrl: string | null;
  duration: number;
  playedAt: string;
}

type HistoryRow = Omit<HistoryEntry, 'trackUrn'> & { trackUrn: string | null };

const hasTrackUrn = (row: HistoryRow): row is HistoryEntry => !!row.trackUrn;

export function useHistory(limit = 50) {
  const query = useInfiniteQuery({
    queryKey: ['history'],
    queryFn: async ({ pageParam = 0 }) => {
      return api<{ collection: HistoryRow[]; total: number }>(
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

  const entries = useMemo(
    () => flattenCollectionPages(query.data?.pages).filter(hasTrackUrn),
    [query.data],
  );

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
    queryFn: () => api<FeaturedResponse | null>('/featured'),
    staleTime: 5 * 60_000,
  });
}

/* ── Liked tracks ──────────────────────────────────────────────── */

export function useLikedTracks(limit = 30) {
  const query = usePagedQuery<Track>({
    queryKey: ['me', 'likes', 'tracks', limit],
    url: (page, l) => pagedUrl('/me/likes/tracks', page, l),
    limit,
    staleTime: COLD_CACHE_MS,
    dedupe: urnOf,
  });

  const tracks = query.items;

  useEffect(() => {
    if (tracks.length > 0) initLikedUrns(tracks);
  }, [tracks]);

  const pages = query.data?.pages;
  const hasNextPage = query.hasNextPage;
  useEffect(() => {
    if (!pages) return;
    const snapshot = hasNextPage ? INCOMPLETE_LIKES : likedSnapshotOf(pages.map((p) => p.sync));
    void rememberLikedTracks(tracks, snapshot);
  }, [pages, tracks, hasNextPage]);

  return { tracks, ...query };
}

const INCOMPLETE_LIKES: LikedSnapshot = { complete: false };

function likedSnapshotOf(syncs: (CollectionSync | undefined)[]): LikedSnapshot {
  const complete =
    syncs.length > 0 && syncs.every((sync) => !!sync?.lastCompletedAt && !isPartialSync(sync));
  return { complete, confirmedEmpty: complete && syncs.every((sync) => sync?.status === 'ready') };
}

export interface LikedTracksResult extends LikedSnapshot {
  tracks: Track[];
}

/**
 * Fetch ALL liked tracks. Page-based pagination, shared promise.
 * Optional onPage callback fires per page during the fetch.
 */
let _allLikesPromise: Promise<LikedTracksResult> | null = null;
let _allLikesOwner: string | undefined;

export function fetchAllLikedTracks(
  pageSize = 200,
  onPage?: (tracks: Track[]) => void,
): Promise<Track[]> {
  return fetchLikedTracksSnapshot(pageSize, onPage).then((result) => result.tracks);
}

export function fetchLikedTracksSnapshot(
  pageSize = 200,
  onPage?: (tracks: Track[]) => void,
): Promise<LikedTracksResult> {
  const owner = useAuthStore.getState().user?.urn;
  if (_allLikesOwner !== owner) _allLikesPromise = null;
  if (_allLikesPromise && !onPage) return _allLikesPromise;

  const promise = (async () => {
    const all: Track[] = [];
    const syncs: (CollectionSync | undefined)[] = [];
    for (let page = 0; ; page++) {
      const data = await api<TrackPage>(pagedUrl('/me/likes/tracks', page, pageSize));
      syncs.push(data.sync);
      for (const t of data.collection) all.push(t);
      void rememberTracks(data.collection);
      onPage?.(data.collection);
      if (!data.has_more) break;
    }
    const snapshot = likedSnapshotOf(syncs);
    void rememberLikedTracks(all, snapshot);
    return { tracks: all, ...snapshot };
  })();

  if (!onPage) {
    _allLikesPromise = promise;
    _allLikesOwner = owner;
    promise.then(
      (result) => {
        if (!result.complete && _allLikesPromise === promise) _allLikesPromise = null;
      },
      () => {
        _allLikesPromise = null;
      },
    );
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
    queryFn: () => fetchRelatedTracks(trackUrn!, limit),
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

/* ── Playlist Detail (cold) ───────────────────────────────────── */

export function usePlaylist(playlistUrn: string | undefined) {
  return useQuery({
    queryKey: ['playlist', playlistUrn],
    queryFn: () => api<Playlist>(`/playlists/${encodeURIComponent(playlistUrn!)}`),
    enabled: !!playlistUrn,
    staleTime: COLD_CACHE_MS,
    gcTime: INFINITE_GC_MS,
    ...retryWhileRefreshing,
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

  const sync = query.data?.pages[0]?.sync as PlaylistSync | undefined;
  return { tracks: query.items, sync, ...query };
}

/* ── User Profile (cold) ──────────────────────────────────────── */

export function useUser(userUrn: string | undefined) {
  return useQuery({
    queryKey: ['user', userUrn],
    queryFn: () => api<UserProfile>(`/users/${encodeURIComponent(userUrn!)}`),
    enabled: !!userUrn,
    staleTime: COLD_CACHE_MS,
    gcTime: INFINITE_GC_MS,
    ...retryWhileRefreshing,
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

const EMPTY_TRACKS: Track[] = [];

export function useUserPopularTracks(userUrn: string | undefined) {
  const qc = useQueryClient();
  const queryKey = ['user', userUrn, 'tracks', 'popular'];
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const all: Track[] = [];
      let partial = false;
      const pageSize = 100;
      for (let page = 0; ; page++) {
        const data = await api<TrackPage>(
          pagedUrl(`/users/${encodeURIComponent(userUrn!)}/tracks`, page, pageSize),
        );
        partial ||= isPartialSync(data.sync);
        for (const t of data.collection) all.push(t);
        if (!data.has_more) break;
      }
      all.sort((a, b) => (b.playback_count ?? 0) - (a.playback_count ?? 0));
      return { tracks: all, partial };
    },
    refetchInterval: (query) =>
      query.state.data?.partial && query.state.dataUpdateCount < PARTIAL_REFETCH_LIMIT
        ? PARTIAL_REFETCH_MS
        : false,
    enabled: !!userUrn,
    staleTime: COLD_CACHE_MS,
    gcTime: INFINITE_GC_MS,
  });

  const refetches = qc.getQueryState(queryKey)?.dataUpdateCount ?? 0;
  const syncState: CollectionSyncState = !query.data?.partial
    ? 'complete'
    : refetches >= PARTIAL_REFETCH_LIMIT
      ? 'stalled'
      : 'syncing';
  return { ...query, tracks: query.data?.tracks ?? EMPTY_TRACKS, syncState };
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
    queryFn: () => api<WebProfile[]>(`/users/${encodeURIComponent(userUrn!)}/web-profiles`),
    enabled: !!userUrn,
    staleTime: MEDIUM_CACHE_MS,
    gcTime: INFINITE_GC_MS,
    ...retryWhileRefreshing,
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

// Перестановка из свежей загруженной вью — шлём `{order}`-дельту
// (а не PUT всего списка): backend применяет к desired-state и пушит в SC фоном.
export function useUpdatePlaylistTracks(playlistUrn: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trackUrns: string[]) => editPlaylistTracks(playlistUrn!, { order: trackUrns }),
    onError: toastPlaylistEditError,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['playlist', playlistUrn] });
      qc.invalidateQueries({ queryKey: ['playlist', playlistUrn, 'tracks'] });
      qc.invalidateQueries({ queryKey: ['me', 'playlists'] });
    },
  });
}

export function useRemoveFromPlaylist(playlistUrn: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trackUrn: string) => editPlaylistTracks(playlistUrn!, { remove: trackUrn }),
    onError: toastPlaylistEditError,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['playlist', playlistUrn] });
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
        last = await editPlaylistTracks(playlistUrn, { add: urn });
      }
      return last;
    },
    onError: toastPlaylistEditError,
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
      api<{ status?: string }>('/playlists', {
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
    onSuccess: (result) => {
      const refresh = () => qc.invalidateQueries({ queryKey: ['me', 'playlists'] });
      void refresh();
      if (result?.status !== 'queued') return;
      for (const delay of QUEUED_CREATE_REFRESH_MS) setTimeout(refresh, delay);
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

export function useUpdatePlaylistDetails(playlistUrn: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (details: PlaylistDetails) => updatePlaylistDetails(playlistUrn!, details),
    onError: toastPlaylistEditError,
    onSuccess: (_data, details) => {
      qc.setQueryData<Playlist>(['playlist', playlistUrn], (old) =>
        old ? { ...old, title: details.title, description: details.description || null } : old,
      );
      useSettingsStore.getState().renamePinnedPlaylist(playlistUrn!, details.title);
      qc.invalidateQueries({ queryKey: ['playlist', playlistUrn], exact: true });
      qc.invalidateQueries({ queryKey: ['me', 'playlists'] });
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

export function useUpdateTrackDetails(trackUrn: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (details: TrackDetails) => updateTrackDetails(trackUrn!, details),
    onError: toastTrackEditError,
    onSuccess: (_data, details) => {
      qc.setQueryData<Track>(['track', trackUrn], (old) => (old ? { ...old, ...details } : old));
      qc.invalidateQueries({ queryKey: ['track', trackUrn], exact: true });
      qc.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

export function useDeleteTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trackUrn: string) => deleteTrack(trackUrn),
    onError: toastTrackEditError,
    onSuccess: (_data, trackUrn) => {
      qc.removeQueries({ queryKey: ['track', trackUrn], exact: true });
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
          fetchRelatedTracks(urn, 20).catch(
            () => ({ collection: [], page: 0, page_size: 20, has_more: false }) as TrackPage,
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

/**
 * Общий related-pool фид: рекомендации + дискавери по жанрам, всё из лайков
 * зрителя. Только данные (без рендера), чтобы полка «Recommended» на Home и
 * призма Discover читали один источник, а не пересобирали пул каждая у себя.
 */
export function useDiscoverFeed() {
  const { tracks: likedTracks } = useLikedTracks(100);
  const { data: pool, isLoading } = useRelatedPool(likedTracks);
  const recommended = useRecommendedTracks(pool, 40);
  const byGenre = useDiscoverData(pool, likedTracks);
  return { likedTracks, isLoading, recommended, byGenre };
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
