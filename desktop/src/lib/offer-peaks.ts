import { useEffect } from 'react';
import { useOfferPeak } from '../stores/offer-peak';
import { usePlayerStore } from '../stores/player';
import { useSuperlikeLimit } from '../stores/superlike-limit';

const PLAYS_PEAK = 8;
const SESSION_MS = 45 * 60_000;
const BREAK_MS = 15 * 60_000;

export function useOfferPeaks(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const raise = useOfferPeak.getState().raise;
    const start = usePlayerStore.getState();
    let urn = start.currentTrack?.urn ?? null;
    let since = start.isPlaying ? Date.now() : null;
    let listened = 0;
    let pausedAt = 0;
    let plays = 0;

    const offPlayer = usePlayerStore.subscribe((s) => {
      const next = s.currentTrack?.urn ?? null;
      if (next && next !== urn && s.isPlaying && ++plays === PLAYS_PEAK) raise();
      urn = next;
      const now = Date.now();
      if (s.isPlaying && since === null) {
        if (pausedAt && now - pausedAt > BREAK_MS) listened = 0;
        since = now;
      } else if (!s.isPlaying && since !== null) {
        listened += now - since;
        since = null;
        pausedAt = now;
        if (listened >= SESSION_MS) {
          listened = 0;
          raise();
        }
      }
    });
    const offLock = useSuperlikeLimit.subscribe((s, prev) => {
      if (s.wanted && !prev.wanted) raise();
    });
    return () => {
      offPlayer();
      offLock();
    };
  }, [active]);
}
