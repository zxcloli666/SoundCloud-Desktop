import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Track } from '../stores/player';
import { api } from './api';
import { SEND_BEHAVIORAL_DATA } from './constants';

export interface RecommendResult {
  id: string | number;
  score?: number;
  payload?: Record<string, unknown>;
}

export interface IndexingStats {
  indexed: number;
  pending: number;
}

const SW_STALE_MS = 0;
const SW_GC_MS = 1000 * 60 * 5;
const HYDRATE_BATCH_SIZE = 50;

interface HydratedTrackPage {
  collection?: Track[];
}

function normLanguages(langs: string[] | undefined): string | undefined {
  if (!langs || langs.length === 0) return undefined;
  return [...langs].sort().join(',');
}

/**
 * Hydrate Qdrant numeric IDs → full SC track metadata, preserving recommendation order.
 *
 * The batch `/tracks?ids=` endpoint returns full metadata with real duration.
 * Chunking avoids a request fan-out when a recommendation response contains
 * several shelves while preserving the model's original ranking.
 */
export async function hydrateByIds(
  recs: RecommendResult[],
  signal?: AbortSignal,
): Promise<Track[]> {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const recommendation of recs) {
    const id = String(recommendation.id).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  if (ids.length === 0) return [];

  const batches: string[][] = [];
  for (let offset = 0; offset < ids.length; offset += HYDRATE_BATCH_SIZE) {
    batches.push(ids.slice(offset, offset + HYDRATE_BATCH_SIZE));
  }

  const pages = await Promise.all(
    batches.map((batch) => {
      const encodedIds = encodeURIComponent(batch.join(','));
      return api<HydratedTrackPage>(`/tracks?ids=${encodedIds}&page=0&limit=${batch.length}`, {
        signal,
      }).catch((error) => {
        if (signal?.aborted) throw error;
        return { collection: [] } as HydratedTrackPage;
      });
    }),
  );

  const byId = new Map<string, Track>();
  for (const page of pages) {
    for (const track of page.collection ?? []) {
      const id = track.urn.split(':').pop() || String(track.id);
      if (id) byId.set(id, track);
    }
  }

  return ids.map((id) => byId.get(id)).filter((track): track is Track => track !== undefined);
}

export type SmartWaveSeedKind = 'user' | 'track' | 'artist';

export interface SmartWaveBatch {
  tracks: Track[];
  cursor: string;
}

interface SmartWavePayload {
  tracks: RecommendResult[];
  cursor: string;
}

function smartWaveUrl(
  seedKind: SmartWaveSeedKind,
  seedId: string | undefined,
  qs: URLSearchParams,
): string {
  switch (seedKind) {
    case 'user':
      return `/recommendations/wave${qs.toString() ? `?${qs}` : ''}`;
    case 'track':
      return `/recommendations/wave/from-track/${encodeURIComponent(seedId!)}${qs.toString() ? `?${qs}` : ''}`;
    case 'artist':
      return `/recommendations/wave/from-artist/${encodeURIComponent(seedId!)}${qs.toString() ? `?${qs}` : ''}`;
  }
}

/**
 * Запрос порции бесконечной волны. Сервер держит state по cursor'у
 * (Redis, TTL 30 мин) — клиент эхает токен и получает свежие треки без
 * повторов. Если cursor отсутствует или Redis грохнули — сервер начнёт
 * новую сессию волны, для UX это незаметно.
 */
export async function fetchSmartWave(opts: {
  seedKind: SmartWaveSeedKind;
  seedId?: string;
  cursor?: string;
  limit?: number;
  languages?: string[];
  hideListened?: boolean;
  signal?: AbortSignal;
}): Promise<SmartWaveBatch> {
  const qs = new URLSearchParams();
  qs.set('limit', String(opts.limit ?? 20));
  if (opts.cursor) qs.set('cursor', opts.cursor);
  const languages = normLanguages(opts.languages);
  if (languages) qs.set('languages', languages);
  // Бэк дефолтит hide_listened=ON; шлём явный флаг только когда он задан.
  if (opts.hideListened !== undefined) qs.set('hide_listened', opts.hideListened ? '1' : '0');

  const payload = await api<SmartWavePayload>(smartWaveUrl(opts.seedKind, opts.seedId, qs), {
    signal: opts.signal,
  }).catch((error) => {
    if (opts.signal?.aborted) throw error;
    return { tracks: [], cursor: '' } as SmartWavePayload;
  });

  // Don't trust the API shape: a resolved-but-null/garbage body must not crash.
  const ids = Array.isArray(payload?.tracks) ? payload.tracks : [];
  const cursor = payload?.cursor ?? '';
  if (ids.length === 0) {
    return { tracks: [], cursor };
  }
  const tracks = await hydrateByIds(ids, opts.signal);
  return { tracks, cursor };
}

/**
 * Сообщить серверу о dis/pos исходах в недавнем окне волны.
 * Cursor обновится на сервере и следующий fetchSmartWave получит выдачу
 * с адаптированными весами arm'ов.
 */
export async function sendWaveFeedback(opts: {
  cursor: string;
  negatives: number;
  positives: number;
  signal?: AbortSignal;
}): Promise<string | null> {
  if (!SEND_BEHAVIORAL_DATA) return null;
  if (!opts.cursor) return null;
  const { signal, ...payload } = opts;
  try {
    const res = await api<{ ok: boolean; cursor?: string | null }>(
      '/recommendations/wave/feedback',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      },
    );
    return res?.cursor ?? null;
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  }
}

/**
 * React-Query обёртка для первой порции волны. Дальше работает в паре с
 * `useInfiniteWave`, который сам шлёт `fetchSmartWave({ cursor })`.
 */
export function useSmartWave(opts: {
  seedKind: SmartWaveSeedKind;
  seedId?: string;
  languages?: string[];
  enabled?: boolean;
  limit?: number;
  hideListened?: boolean;
}) {
  const enabled = opts.enabled !== false && (opts.seedKind === 'user' || !!opts.seedId);
  const languages = normLanguages(opts.languages);

  return useQuery<SmartWaveBatch>({
    queryKey: [
      'smartwave',
      opts.seedKind,
      opts.seedId ?? 'self',
      languages ?? 'all',
      opts.limit ?? 20,
      opts.hideListened ?? 'default',
    ],
    enabled,
    staleTime: SW_STALE_MS,
    gcTime: SW_GC_MS,
    queryFn: ({ signal }) =>
      fetchSmartWave({
        seedKind: opts.seedKind,
        seedId: opts.seedId,
        languages: opts.languages,
        limit: opts.limit,
        hideListened: opts.hideListened,
        signal,
      }),
  });
}

/**
 * Endless home-wave board for the Search landing — the "затягивающая сетка".
 *
 * Курсор волны на бэке STATEFUL (токен = id сессии, позиция двигается в Redis) —
 * это несовместимо с refetch-моделью `useInfiniteQuery` (рефетч страниц на
 * stateful-курсоре отдаёт другое → лента вставала после пары экранов). Поэтому
 * пагинируем ВРУЧНУЮ: только вперёд, append, без рефетча. Плюс при КАЖДОМ заходе
 * стартуем СВЕЖУЮ волну (топ-треки), а не доигрываем посредственный хвост.
 */
export function useWaveBoard(opts?: {
  enabled?: boolean;
  languages?: string[];
  hideListened?: boolean;
}) {
  const enabled = opts?.enabled !== false;
  const langKey = normLanguages(opts?.languages) ?? 'all';
  const hideListened = opts?.hideListened;
  const languagesRef = useRef(opts?.languages);
  languagesRef.current = opts?.languages;
  const hideListenedRef = useRef(hideListened);
  hideListenedRef.current = hideListened;

  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);

  const cursorRef = useRef<string | undefined>(undefined);
  const seenRef = useRef<Set<string>>(new Set());
  const fetchingRef = useRef(false);
  const pageAbortRef = useRef<AbortController | null>(null);

  // Свежий старт при каждом заходе / смене языка: топ волны, не хвост.
  // biome-ignore lint/correctness/useExhaustiveDependencies: langKey намеренно триггерит fresh-волну при смене языка (значение читаем через ref, чтобы не словить stale-замыкание).
  useEffect(() => {
    const pendingPage = pageAbortRef.current;
    pageAbortRef.current = null;
    pendingPage?.abort();
    if (!enabled) {
      fetchingRef.current = false;
      setTracks([]);
      setHasNextPage(true);
      setIsLoading(false);
      setIsFetchingNextPage(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    cursorRef.current = undefined;
    seenRef.current = new Set();
    fetchingRef.current = true;
    setTracks([]);
    setHasNextPage(true);
    setIsLoading(true);
    void (async () => {
      try {
        const batch = await fetchSmartWave({
          seedKind: 'user',
          limit: 24,
          languages: languagesRef.current,
          hideListened: hideListenedRef.current,
          signal: controller.signal,
        });
        if (cancelled) return;
        cursorRef.current = batch.cursor || undefined;
        setTracks(dedupeNew(batch.tracks, seenRef.current));
        setHasNextPage(batch.tracks.length > 0 && !!batch.cursor);
      } catch {
        if (!cancelled) setHasNextPage(false);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          fetchingRef.current = false;
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, langKey, hideListened]);

  const fetchNextPage = useCallback(async () => {
    if (!enabled || fetchingRef.current || !hasNextPage) return;
    fetchingRef.current = true;
    setIsFetchingNextPage(true);
    const controller = new AbortController();
    pageAbortRef.current = controller;
    try {
      const batch = await fetchSmartWave({
        seedKind: 'user',
        cursor: cursorRef.current,
        limit: 24,
        languages: languagesRef.current,
        hideListened: hideListenedRef.current,
        signal: controller.signal,
      });
      cursorRef.current = batch.cursor || cursorRef.current;
      const fresh = dedupeNew(batch.tracks, seenRef.current);
      if (fresh.length > 0) setTracks((prev) => [...prev, ...fresh]);
      setHasNextPage(batch.tracks.length > 0); // пусто = волна иссякла
    } catch {
      if (!controller.signal.aborted) setHasNextPage(false);
    } finally {
      if (pageAbortRef.current === controller) {
        pageAbortRef.current = null;
        fetchingRef.current = false;
        setIsFetchingNextPage(false);
      }
    }
  }, [enabled, hasNextPage]);

  useEffect(
    () => () => {
      const controller = pageAbortRef.current;
      pageAbortRef.current = null;
      controller?.abort();
    },
    [],
  );

  return { tracks, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage };
}

function dedupeNew(batch: Track[], seen: Set<string>): Track[] {
  const out: Track[] = [];
  for (const t of batch) {
    if (t?.urn && !seen.has(t.urn)) {
      seen.add(t.urn);
      out.push(t);
    }
  }
  return out;
}

/** Optional lightweight poll of indexing stats. Fails silently if endpoint absent. */
export function useIndexingStats() {
  return useQuery({
    queryKey: ['soundwave', 'indexing-stats'],
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
    retry: false,
    queryFn: ({ signal }) =>
      api<IndexingStats>('/indexing/stats', { signal }).catch((error) => {
        if (signal.aborted) throw error;
        return null as IndexingStats | null;
      }),
  });
}
