import { useEffect, useRef } from 'react';
import { fetchSmartWave, type SmartWaveSeedKind } from '../../../lib/soundwave';
import { followWave, sendWaveFeedback, type WaveTally } from '../../../lib/wave-feedback';
import type { Track } from '../../../stores/player';
import { usePlayerStore } from '../../../stores/player';

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
    minTail = 4,
    batchLimit = 10,
  } = opts;

  const tallyRef = useRef<WaveTally>({
    owned: new Set(),
    decided: new Map(),
    negatives: 0,
    positives: 0,
  });
  const cursorRef = useRef('');
  const shelfCursorRef = useRef(initialCursor);
  const fetchingRef = useRef(false);
  const waveSessionRef = useRef(false);
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
    shelfCursorRef.current = initialCursor;
  }, [initialCursor]);

  useEffect(() => {
    for (const t of initialTracks) tallyRef.current.owned.add(t.urn);
  }, [initialTracks]);

  useEffect(() => {
    if (!enabled) return;
    return followWave(tallyRef.current);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    cursorRef.current = '';
    tallyRef.current.negatives = 0;
    tallyRef.current.positives = 0;
    tallyRef.current.decided.clear();

    const refill = async (cursor: string) => {
      const batch = await fetchSmartWave({
        seedKind,
        seedId,
        cursor: cursor || undefined,
        limit: batchLimit,
        languages: languagesRef.current,
        hideListened: hideListenedRef.current,
      });
      if (live && batch.cursor) cursorRef.current = batch.cursor;
      const filterFn = filterRef.current;
      const existing = new Set(usePlayerStore.getState().queue.map((t) => t.urn));
      const fresh = batch.tracks.filter((t) => !existing.has(t.urn) && (!filterFn || filterFn(t)));
      if (fresh.length > 0) {
        usePlayerStore.getState().addToQueue(fresh);
        for (const t of fresh) tallyRef.current.owned.add(t.urn);
      }
    };

    const unsubscribe = usePlayerStore.subscribe((state, prev) => {
      const { queue, queueIndex, currentTrack, isPlaying } = state;
      if (state.playSeq !== prev.playSeq) {
        waveSessionRef.current = queue.every((t) => tallyRef.current.owned.has(t.urn));
      }
      const trackChanged = currentTrack?.urn !== prev.currentTrack?.urn;
      if (
        !trackChanged &&
        queueIndex === prev.queueIndex &&
        queue.length === prev.queue.length &&
        isPlaying === prev.isPlaying
      ) {
        return;
      }
      if (fetchingRef.current) return;

      const owned = tallyRef.current.owned;
      const onWave = !!currentTrack && owned.has(currentTrack.urn);
      const leftWave = !!prev.currentTrack && owned.has(prev.currentTrack.urn);
      const remaining = queue.length - queueIndex - 1;
      const waveAhead = queue.slice(queueIndex + 1).filter((t) => owned.has(t.urn)).length;
      const needsRefill =
        waveSessionRef.current && onWave && waveAhead <= minTail && (isPlaying || remaining <= 0);
      const ping = trackChanged && (onWave || leftWave);
      if (!needsRefill && !ping) return;

      fetchingRef.current = true;
      (async () => {
        try {
          const cursor = cursorRef.current || shelfCursorRef.current || '';
          cursorRef.current = cursor;
          const next = (await sendWaveFeedback(cursor, tallyRef.current)) ?? cursor;
          cursorRef.current = next;
          if (needsRefill) await refill(next);
        } catch (e) {
          console.debug('[soundwave] infinite refill failed:', e);
        } finally {
          fetchingRef.current = false;
        }
      })();
    });

    return () => {
      live = false;
      unsubscribe();
    };
  }, [enabled, seedKind, seedId, minTail, batchLimit]);
}
