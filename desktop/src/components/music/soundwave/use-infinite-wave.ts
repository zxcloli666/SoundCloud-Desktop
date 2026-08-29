import { useEffect, useRef } from 'react';
import { isUrnDisliked } from '../../../lib/dislikes';
import { subscribeSoundWaveOutcomes } from '../../../lib/events';
import { isRecommendationTrackPlayable } from '../../../lib/home-recommendations';
import { curateWithLocalTaste } from '../../../lib/local-recommendations';
import { fetchSmartWave, type SmartWaveSeedKind, sendWaveFeedback } from '../../../lib/soundwave';
import type { Track } from '../../../stores/player';
import { getPlayerQueueRevision, usePlayerStore } from '../../../stores/player';

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
  hideLiked?: boolean;
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
    hideLiked,
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
  const seedRef = useRef<{ kind: SmartWaveSeedKind; id?: string } | null>(null);
  const initialTracksRef = useRef(initialTracks);
  const initialCursorRef = useRef(initialCursor);
  const languagesRef = useRef(languages);
  const filterRef = useRef(filterTrack);
  const hideLikedRef = useRef(hideLiked);
  const hideListenedRef = useRef(hideListened);

  initialTracksRef.current = initialTracks;
  initialCursorRef.current = initialCursor;

  useEffect(() => {
    languagesRef.current = languages;
  }, [languages]);
  useEffect(() => {
    filterRef.current = filterTrack;
  }, [filterTrack]);
  useEffect(() => {
    hideLikedRef.current = hideLiked;
  }, [hideLiked]);
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
    const previousSeed = seedRef.current;
    const seedChanged =
      previousSeed === null || previousSeed.kind !== seedKind || previousSeed.id !== seedId;
    seedRef.current = { kind: seedKind, id: seedId };
    if (seedChanged) {
      const controller = abortRef.current;
      abortRef.current = null;
      controller?.abort();
      fetchingRef.current = false;
      cursorRef.current = initialCursorRef.current ?? '';
      ownedRef.current = new Set(initialTracksRef.current.map((track) => track.urn));
      negCountRef.current = 0;
      posCountRef.current = 0;
    }

    if (!enabled) {
      abortRef.current?.abort();
      abortRef.current = null;
      fetchingRef.current = false;
      return;
    }

    const unsubscribeOutcomes = subscribeSoundWaveOutcomes((outcome) => {
      if (!ownedRef.current.has(outcome.scTrackId)) return;
      if (
        outcome.eventType === 'full_play' ||
        outcome.eventType === 'like' ||
        outcome.eventType === 'local_like' ||
        outcome.eventType === 'playlist_add'
      ) {
        posCountRef.current += 1;
      } else if (outcome.eventType === 'skip' || outcome.eventType === 'dislike') {
        negCountRef.current += 1;
      }
    });

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
      const refillQueueRevision = getPlayerQueueRevision();
      const controller = new AbortController();
      abortRef.current = controller;
      void (async () => {
        try {
          if (cursorRef.current && (negCountRef.current > 0 || posCountRef.current > 0)) {
            const negatives = negCountRef.current;
            const positives = posCountRef.current;
            const updated = await sendWaveFeedback({
              cursor: cursorRef.current,
              negatives,
              positives,
              signal: controller.signal,
            });
            if (controller.signal.aborted) return;
            negCountRef.current = Math.max(0, negCountRef.current - negatives);
            posCountRef.current = Math.max(0, posCountRef.current - positives);
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
          const eligible = batch.tracks.filter(
            (t) =>
              !existing.has(t.urn) &&
              !isUrnDisliked(t.urn) &&
              isRecommendationTrackPlayable(t) &&
              (!filterFn || filterFn(t)),
          );
          const hideRecent = hideListenedRef.current === true;
          const fresh = curateWithLocalTaste(eligible, {
            hideLiked: hideLikedRef.current === true,
            hideListened: hideRecent,
            limit: eligible.length,
          });
          if (fresh.length > 0) {
            const livePlayer = usePlayerStore.getState();
            if (
              getPlayerQueueRevision() !== refillQueueRevision ||
              !livePlayer.currentTrack ||
              !ownedRef.current.has(livePlayer.currentTrack.urn)
            ) {
              return;
            }
            livePlayer.addToQueue(fresh);
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
      unsubscribeOutcomes();
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
