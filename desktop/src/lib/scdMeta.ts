import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Track, TrackScdMeta } from '../stores/player';
import { api } from './api';

/**
 * Клиентский добор `_scd_meta` (статус-бейдж трека) для шелфов из SC-источников.
 *
 * `/tracks/:urn/related` (и public-search) приходят SC-shaped без нашей меты, а
 * она нужна для бейджа A/C/F. Сначала используем batch `/tracks?ids=`, затем
 * ограниченно проверяем отсутствующие значения через `/tracks/:urn`.
 */
const metaCache = new Map<string, TrackScdMeta>();

/** `pending` storage/index ещё перевернётся (pending→ok, pending→indexed) —
 *  такую мету НЕ пиним, иначе бейдж замёрзнет на первом увиденном статусе на
 *  всю сессию. Кешируем только явно полученную терминальную мету; отсутствие
 *  поля может быть частичным/временным ответом и должно оставаться retryable. */
function isTerminal(meta: TrackScdMeta): boolean {
  return meta.storage_state !== 'pending' && meta.index_state !== 'pending';
}

const META_BATCH_SIZE = 50;
const META_SINGLE_FALLBACK_LIMIT = 12;
const META_SINGLE_FALLBACK_CONCURRENCY = 3;

interface TrackBatchResponse {
  collection?: Track[];
}

async function enrich(tracks: Track[], signal: AbortSignal): Promise<Track[]> {
  const urns = [...new Set(tracks.filter((t) => t.urn && !t._scd_meta).map((t) => t.urn))];
  const resolved = new Map<string, TrackScdMeta>();
  const missing = urns.filter((urn) => {
    if (!metaCache.has(urn)) return true;
    const cached = metaCache.get(urn);
    if (cached) resolved.set(urn, cached);
    return false;
  });
  const needsSingleFallback: string[] = [];

  for (let offset = 0; offset < missing.length; offset += META_BATCH_SIZE) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const batchUrns = missing.slice(offset, offset + META_BATCH_SIZE);
    const ids = batchUrns
      .map((urn) => urn.split(':').pop()?.trim())
      .filter((id): id is string => !!id);
    if (ids.length === 0) continue;

    try {
      const page = await api<TrackBatchResponse>(
        `/tracks?ids=${encodeURIComponent(ids.join(','))}&page=0&limit=${ids.length}`,
        { signal },
      );
      const byUrn = new Map((page.collection ?? []).map((track) => [track.urn, track]));
      for (const urn of batchUrns) {
        const meta = byUrn.get(urn)?._scd_meta ?? null;
        if (!meta) {
          needsSingleFallback.push(urn);
          continue;
        }
        resolved.set(urn, meta);
        if (isTerminal(meta)) metaCache.set(urn, meta);
      }
    } catch (error) {
      if (signal.aborted) throw error;
      needsSingleFallback.push(...batchUrns);
    }
  }

  // A partially deployed backend may hydrate ordinary track data in the batch
  // response without exposing `_scd_meta`. Fall back to the established single
  // endpoint, but cap both total requests and concurrency so a broken batch
  // contract cannot recreate an unbounded N+1 fan-out.
  const fallbackUrns = [...new Set(needsSingleFallback)].slice(0, META_SINGLE_FALLBACK_LIMIT);
  let fallbackCursor = 0;
  const fallbackWorker = async () => {
    while (fallbackCursor < fallbackUrns.length) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const urn = fallbackUrns[fallbackCursor++];
      try {
        const full = await api<Track>(`/tracks/${encodeURIComponent(urn)}`, { signal });
        const meta = full?._scd_meta;
        if (!meta) continue;
        resolved.set(urn, meta);
        if (isTerminal(meta)) metaCache.set(urn, meta);
      } catch (error) {
        if (signal.aborted) throw error;
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(META_SINGLE_FALLBACK_CONCURRENCY, fallbackUrns.length) },
      () => fallbackWorker(),
    ),
  );

  let changed = false;
  const out = tracks.map((t) => {
    if (t._scd_meta || !t.urn) return t;
    const meta = resolved.get(t.urn);
    if (!meta) return t;
    changed = true;
    return { ...t, _scd_meta: meta };
  });
  return changed ? out : tracks;
}

/**
 * Возвращает те же треки, но с добранной `_scd_meta` для бейджей. Бандлит ровно
 * переданный (отрендеренный) список — не весь пул. До загрузки отдаёт исходные
 * треки, потом — обогащённые.
 */
export function useScdMeta(tracks: Track[]): Track[] {
  const key = useMemo(() => tracks.map((t) => t.urn).join(','), [tracks]);
  const needsEnrich = useMemo(() => tracks.some((t) => t.urn && !t._scd_meta), [tracks]);
  const { data } = useQuery({
    queryKey: ['scd-meta-enrich', key],
    queryFn: ({ signal }) => enrich(tracks, signal),
    enabled: needsEnrich,
    staleTime: 10 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  return data ?? tracks;
}
