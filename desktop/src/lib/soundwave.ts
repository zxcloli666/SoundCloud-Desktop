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

function normLanguages(langs: string[] | undefined): string | undefined {
  if (!langs || langs.length === 0) return undefined;
  return [...langs].sort().join(',');
}

/**
 * Hydrate Qdrant numeric IDs → full SC track metadata, preserving recommendation order.
 *
 * Per-track `/tracks/:urn` returns full metadata with real duration (vs. the
 * preview-only public search endpoint). Backend caches these for 10m so a warm
 * cache is effectively free; a cold cache fans out the requests in parallel.
 */
export async function hydrateByIds(recs: RecommendResult[]): Promise<Track[]> {
  const urns = recs
    .map((r) => {
      const id = String(r.id);
      return id ? `soundcloud:tracks:${id}` : null;
    })
    .filter((u): u is string => u !== null);
  if (!urns.length) return [];

  const results = await Promise.all(
    urns.map((urn) =>
      api<Track>(`/tracks/${encodeURIComponent(urn)}`).catch(() => null as Track | null),
    ),
  );

  return results.filter((t): t is Track => t !== null);
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
}): Promise<SmartWaveBatch> {
  const qs = new URLSearchParams();
  qs.set('limit', String(opts.limit ?? 20));
  if (opts.cursor) qs.set('cursor', opts.cursor);
  const languages = normLanguages(opts.languages);
  if (languages) qs.set('languages', languages);
  // Бэк дефолтит hide_listened=ON; шлём явный флаг только когда он задан.
  if (opts.hideListened !== undefined) qs.set('hide_listened', opts.hideListened ? '1' : '0');

  const payload = await api<SmartWavePayload>(smartWaveUrl(opts.seedKind, opts.seedId, qs)).catch(
    () => ({ tracks: [], cursor: '' }) as SmartWavePayload,
  );

  // Don't trust the API shape: a resolved-but-null/garbage body must not crash.
  const ids = Array.isArray(payload?.tracks) ? payload.tracks : [];
  const cursor = payload?.cursor ?? '';
  if (ids.length === 0) {
    return { tracks: [], cursor };
  }
  const tracks = await hydrateByIds(ids);
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
}): Promise<string | null> {
  if (!SEND_BEHAVIORAL_DATA) return null;
  if (!opts.cursor) return null;
  try {
    const res = await api<{ ok: boolean; cursor?: string | null }>(
      '/recommendations/wave/feedback',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      },
    );
    return res?.cursor ?? null;
  } catch {
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
    queryFn: () =>
      fetchSmartWave({
        seedKind: opts.seedKind,
        seedId: opts.seedId,
        languages: opts.languages,
        limit: opts.limit,
        hideListened: opts.hideListened,
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

  // Свежий старт при каждом заходе / смене языка: топ волны, не хвост.
  // biome-ignore lint/correctness/useExhaustiveDependencies: langKey намеренно триггерит fresh-волну при смене языка (значение читаем через ref, чтобы не словить stale-замыкание).
  useEffect(() => {
    if (!enabled) {
      setTracks([]);
      setHasNextPage(true);
      return;
    }
    let cancelled = false;
    cursorRef.current = undefined;
    seenRef.current = new Set();
    fetchingRef.current = true;
    setTracks([]);
    setHasNextPage(true);
    setIsLoading(true);
    (async () => {
      const batch = await fetchSmartWave({
        seedKind: 'user',
        limit: 24,
        languages: languagesRef.current,
        hideListened: hideListenedRef.current,
      });
      if (cancelled) return;
      cursorRef.current = batch.cursor || undefined;
      setTracks(dedupeNew(batch.tracks, seenRef.current));
      setHasNextPage(batch.tracks.length > 0 && !!batch.cursor);
      setIsLoading(false);
      fetchingRef.current = false;
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, langKey, hideListened]);

  const fetchNextPage = useCallback(async () => {
    if (!enabled || fetchingRef.current || !hasNextPage) return;
    fetchingRef.current = true;
    setIsFetchingNextPage(true);
    try {
      const batch = await fetchSmartWave({
        seedKind: 'user',
        cursor: cursorRef.current,
        limit: 24,
        languages: languagesRef.current,
        hideListened: hideListenedRef.current,
      });
      cursorRef.current = batch.cursor || cursorRef.current;
      const fresh = dedupeNew(batch.tracks, seenRef.current);
      if (fresh.length > 0) setTracks((prev) => [...prev, ...fresh]);
      setHasNextPage(batch.tracks.length > 0); // пусто = волна иссякла
    } finally {
      fetchingRef.current = false;
      setIsFetchingNextPage(false);
    }
  }, [enabled, hasNextPage]);

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
    queryFn: () => api<IndexingStats>('/indexing/stats').catch(() => null as IndexingStats | null),
  });
}
