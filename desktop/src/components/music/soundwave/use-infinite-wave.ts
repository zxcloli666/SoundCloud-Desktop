import { useEffect, useRef } from 'react';
import { fetchSmartWave, type SmartWaveSeedKind, sendWaveFeedback } from '../../../lib/soundwave';
import type { Track } from '../../../stores/player';
import { usePlayerStore } from '../../../stores/player';

/**
 * Бесконечная SmartWave-волна на стороне клиента.
 *
 * 1. Хук владеет cursor'ом — серверным токеном, который помнит уже отданное
 *    и адаптивные веса arm'ов. После каждой подгрузки cursor обновляется.
 *    Если Redis грохнули — сервер начнёт новую сессию, для UX незаметно.
 * 2. Refill срабатывает только если играет наш трек и в очереди осталось
 *    меньше `minTail` хвоста. `ownedRef` — Set urn'ов, которые мы положили;
 *    чужие очереди (плейлисты, лайки) не триггерят refill.
 * 3. Feedback (dis/pos) накапливается между refill'ами; перед следующим
 *    fetch шлём батч, сервер пересчитает веса arm'ов.
 */
export function useInfiniteWave(opts: {
  enabled: boolean;
  seedKind: SmartWaveSeedKind;
  seedId?: string;
  initialTracks: Track[];
  initialCursor: string | null;
  languages?: string[];
  filterTrack?: (t: Track) => boolean;
  hideListened?: boolean;
  minTail?: number;
  batchLimit?: number;
}) {
  const {
    enabled,
    seedKind,
    seedId,
    initialTracks,
    initialCursor,
    languages,
    filterTrack,
    hideListened,
    minTail = 5,
    batchLimit = 20,
  } = opts;

  const ownedRef = useRef<Set<string>>(new Set());
  const cursorRef = useRef<string>(initialCursor ?? '');
  const fetchingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const negCountRef = useRef(0);
  const posCountRef = useRef(0);
  const languagesRef = useRef(languages);
  const filterRef = useRef(filterTrack);
  const hideListenedRef = useRef(hideListened);

  useEffect(() => {
    languagesRef.current = languages;
  }, [languages]);
  useEffect(() => {
    filterRef.current = filterTrack;
  }, [filterTrack]);
  useEffect(() => {
    hideListenedRef.current = hideListened;
  }, [hideListened]);

  useEffect(() => {
    if (initialCursor) cursorRef.current = initialCursor;
  }, [initialCursor]);

  useEffect(() => {
    for (const t of initialTracks) ownedRef.current.add(t.urn);
  }, [initialTracks]);

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      abortRef.current = null;
      fetchingRef.current = false;
      return;
    }

    const unsubscribe = usePlayerStore.subscribe((state, prev) => {
      const { queue, queueIndex, currentTrack, isPlaying } = state;
      // Narrowed: only react to refill-relevant fields.
      if (
        queueIndex === prev.queueIndex &&
        queue.length === prev.queue.length &&
        currentTrack?.urn === prev.currentTrack?.urn &&
        isPlaying === prev.isPlaying
      ) {
        return;
      }
      if (!currentTrack) return;
      if (!ownedRef.current.has(currentTrack.urn)) return;

      const remaining = queue.length - queueIndex - 1;
      if (remaining > minTail) return;
      if (!isPlaying && remaining > 0) return;
      if (fetchingRef.current) return;

      fetchingRef.current = true;
      const controller = new AbortController();
      abortRef.current = controller;
      void (async () => {
        try {
          if (cursorRef.current && (negCountRef.current > 0 || posCountRef.current > 0)) {
            const updated = await sendWaveFeedback({
              cursor: cursorRef.current,
              negatives: negCountRef.current,
              positives: posCountRef.current,
              signal: controller.signal,
            });
            negCountRef.current = 0;
            posCountRef.current = 0;
            if (updated) cursorRef.current = updated;
          }
          const batch = await fetchSmartWave({
            seedKind,
            seedId,
            cursor: cursorRef.current || undefined,
            limit: batchLimit,
            languages: languagesRef.current,
            hideListened: hideListenedRef.current,
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          if (batch.cursor) cursorRef.current = batch.cursor;
          const filterFn = filterRef.current;
          const existing = new Set(usePlayerStore.getState().queue.map((t) => t.urn));
          const fresh = batch.tracks.filter(
            (t) => !existing.has(t.urn) && (!filterFn || filterFn(t)),
          );
          if (fresh.length > 0) {
            usePlayerStore.getState().addToQueue(fresh);
            for (const t of fresh) ownedRef.current.add(t.urn);
          }
        } catch (e) {
          if (!controller.signal.aborted) console.debug('[soundwave] infinite refill failed:', e);
        } finally {
          if (abortRef.current === controller) {
            abortRef.current = null;
            fetchingRef.current = false;
          }
        }
      })();
    });

    return () => {
      unsubscribe();
      const controller = abortRef.current;
      abortRef.current = null;
      controller?.abort();
      fetchingRef.current = false;
    };
  }, [enabled, seedKind, seedId, minTail, batchLimit]);

  return {
    recordNegative: () => {
      negCountRef.current += 1;
    },
    recordPositive: () => {
      posCountRef.current += 1;
    },
    isOwned: (urn: string) => ownedRef.current.has(urn),
  };
}
