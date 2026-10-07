import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { Track } from '../stores/player';
import { useSearchHistoryStore } from '../stores/searchHistory';
import { api } from './api';
import { ApiError, type ApiRequestOptions } from './api-client';
import type { CatalogAlbum, CatalogArtist } from './discover';
import { type PagedResponse, type Playlist, pagedUrl, type SCUser, usePagedQuery } from './hooks';
import { isTimeoutError } from './host-status';

export interface LyricsHit {
  track: Track;
  matchedLine: string | null;
  score: number;
}

export interface VibeResponse {
  items: Track[];
  atmosphere: { topGenres: string[] };
  status?: 'ready' | 'preparing';
}

export interface ResolvedEntity {
  urn: string;
}

export type SearchErrorKind =
  | 'timeout'
  | 'busy'
  | 'soundcloud'
  | 'scBusy'
  | 'vibe'
  | 'offline'
  | 'failed';

interface CatalogStripItems {
  artists: CatalogArtist;
  albums: CatalogAlbum;
  users: SCUser;
  playlists: Playlist;
}

interface ScStripItems {
  users: SCUser;
  playlists: Playlist;
}

const PAGE_LIMIT = 20;
const STRIP_LIMIT = 8;
const LYRICS_LIMIT = 12;
const VIBE_LIMIT = 48;
const VIBE_POLL_MS = 2500;
const VIBE_MAX_POLLS = 6;
const STALE_MS = 2 * 60_000;
const TIMEOUT_MS = 20_000;
const VIBE_TIMEOUT_MS = 30_000;
const LINK_TIMEOUT_MS = 30_000;
const MAX_RETRY_DELAY_S = 10;
export const MIN_SEARCH_QUERY = 2;
const QUIET: ApiRequestOptions = { quiet: true };

const ERROR_KINDS: Record<string, SearchErrorKind> = {
  search_timeout: 'timeout',
  search_busy: 'busy',
  soundcloud_search_unavailable: 'soundcloud',
  soundcloud_search_busy: 'scBusy',
  vibe_unavailable: 'vibe',
};

export function searchErrorKind(error: unknown): SearchErrorKind {
  if (!(error instanceof ApiError)) return isTimeoutError(error) ? 'timeout' : 'offline';
  return ERROR_KINDS[error.code ?? ''] ?? 'failed';
}

export function searchRetry(failureCount: number, error: Error): boolean {
  if (failureCount >= 1) return false;
  if (error instanceof ApiError) return error.status === 503 && !!error.code;
  return !isTimeoutError(error);
}

export function searchRetryDelay(_failureCount: number, error: Error): number {
  const seconds = error instanceof ApiError ? error.retryAfterSeconds : null;
  return Math.min(seconds ?? 1, MAX_RETRY_DELAY_S) * 1000;
}

function params(q: string, extra: Record<string, string | undefined> = {}): string {
  const usp = new URLSearchParams({ q });
  for (const [key, value] of Object.entries(extra)) {
    if (value) usp.set(key, value);
  }
  return usp.toString();
}

const byUrn = (item: { urn: string }) => item.urn;
const byTrackUrn = (hit: LyricsHit) => hit.track.urn;

const shared = {
  staleTime: STALE_MS,
  retry: searchRetry,
  retryDelay: searchRetryDelay,
};

const paged = { ...shared, request: QUIET, timeoutMs: TIMEOUT_MS };

function usePagedSearch<T>(
  key: unknown[],
  base: string,
  q: string,
  limit: number,
  dedupe: (item: T) => string,
  extra?: Record<string, string | undefined>,
) {
  return usePagedQuery<T>({
    ...paged,
    queryKey: ['search', ...key, q, extra ?? {}],
    url: (page, size) => pagedUrl(base, page, size, params(q, extra)),
    limit,
    enabled: q.length >= MIN_SEARCH_QUERY,
    dedupe,
  });
}

function useStrip<T>(key: unknown[], base: string, q: string) {
  return useQuery({
    ...shared,
    queryKey: ['search', ...key, q],
    queryFn: () =>
      api<PagedResponse<T>>(pagedUrl(base, 0, STRIP_LIMIT, params(q)), QUIET, TIMEOUT_MS),
    select: (data) => data.collection,
    enabled: q.length >= MIN_SEARCH_QUERY,
  });
}

export function useCatalogTracks(q: string, userUrn?: string) {
  return usePagedSearch<Track>(['catalog', 'tracks'], '/search/db/tracks', q, PAGE_LIMIT, byUrn, {
    user_urn: userUrn,
  });
}

export function useCatalogPlaylists(q: string, userUrn?: string) {
  return usePagedSearch<Playlist>(
    ['catalog', 'playlists'],
    '/search/db/playlists',
    q,
    PAGE_LIMIT,
    byUrn,
    { user_urn: userUrn },
  );
}

export function useCatalogStrip<K extends keyof CatalogStripItems>(kind: K, q: string) {
  return useStrip<CatalogStripItems[K]>(['catalog', kind], `/search/db/${kind}`, q);
}

export function useLyricsHits(q: string) {
  return usePagedSearch<LyricsHit>(
    ['catalog', 'lyrics'],
    '/search/lyrics',
    q,
    LYRICS_LIMIT,
    byTrackUrn,
    {
      mode: 'text',
    },
  );
}

export function useScTracks(q: string) {
  return usePagedSearch<Track>(['soundcloud', 'tracks'], '/tracks', q, PAGE_LIMIT, byUrn);
}

export function useScStrip<K extends keyof ScStripItems>(kind: K, q: string) {
  return useStrip<ScStripItems[K]>(['soundcloud', kind], `/${kind}`, q);
}

export function useVibe(q: string) {
  const queryClient = useQueryClient();
  const queryKey = ['search', 'vibe', q];
  const query = useQuery({
    ...shared,
    queryKey,
    queryFn: () =>
      api<VibeResponse>(
        `/search/vibe?${params(q, { limit: String(VIBE_LIMIT) })}`,
        QUIET,
        VIBE_TIMEOUT_MS,
      ),
    enabled: q.length >= MIN_SEARCH_QUERY,
    refetchInterval: (state) =>
      state.state.data?.status === 'preparing' && state.state.dataUpdateCount <= VIBE_MAX_POLLS
        ? VIBE_POLL_MS
        : false,
  });
  const preparing = query.data?.status === 'preparing';
  const polls = queryClient.getQueryState(queryKey)?.dataUpdateCount ?? 0;
  const slow = preparing && polls > VIBE_MAX_POLLS;
  const restart = useCallback(
    () => void queryClient.resetQueries({ queryKey: ['search', 'vibe', q], exact: true }),
    [queryClient, q],
  );
  return { ...query, preparing: preparing && !slow, slow, restart };
}

export function useResolvedLink(url: string | null) {
  return useQuery({
    queryKey: ['search', 'link', url],
    queryFn: () =>
      api<ResolvedEntity>(`/resolve?url=${encodeURIComponent(url ?? '')}`, QUIET, LINK_TIMEOUT_MS),
    enabled: !!url,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useRememberQuery(q: string) {
  const addQuery = useSearchHistoryStore((s) => s.addQuery);
  return useCallback(() => addQuery(q), [addQuery, q]);
}
