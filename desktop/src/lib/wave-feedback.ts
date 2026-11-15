import { api } from './api';
import type { SoundWaveEvent } from './events';

export const LATE_SKIP_SHARE = 0.7;

export interface WaveTally {
  owned: Set<string>;
  decided: Map<string, boolean>;
  negatives: number;
  positives: number;
}

const tallies = new Set<WaveTally>();

export function followWave(tally: WaveTally): () => void {
  tallies.add(tally);
  return () => {
    tallies.delete(tally);
  };
}

export function noteWaveOutcome(
  outcome: SoundWaveEvent | 'superlike',
  urn: string,
  positionPct?: number,
): void {
  const negative =
    outcome === 'dislike' || (outcome === 'skip' && (positionPct ?? 0) < LATE_SKIP_SHARE);
  const positive = outcome === 'full_play' || outcome === 'like' || outcome === 'superlike';
  if (!negative && !positive) return;
  for (const tally of tallies) {
    if (!tally.owned.has(urn) || tally.decided.get(urn) === positive) continue;
    tally.decided.set(urn, positive);
    if (positive) tally.positives += 1;
    else tally.negatives += 1;
  }
}

export async function sendWaveFeedback(cursor: string, tally: WaveTally): Promise<string | null> {
  if (!cursor) return null;
  const body = JSON.stringify({ cursor, negatives: tally.negatives, positives: tally.positives });
  tally.negatives = 0;
  tally.positives = 0;
  const reply = await api<{ cursor?: string | null }>('/recommendations/wave/feedback', {
    method: 'POST',
    body,
    quiet: true,
  }).catch(() => null);
  return reply?.cursor || null;
}
