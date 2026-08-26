import { useAuthStore } from '../stores/auth';
import type { Track } from '../stores/player';
import { recordLocalRecommendationEvent } from '../stores/recommendation-taste';
import { api } from './api';
import { SEND_BEHAVIORAL_DATA } from './constants';

export type SoundWaveEvent =
  | 'like'
  | 'local_like'
  | 'playlist_add'
  | 'full_play'
  | 'skip'
  | 'dislike';

export interface SoundWaveOutcome {
  eventType: SoundWaveEvent;
  scTrackId: string;
  positionPct?: number;
}

const outcomeListeners = new Set<(outcome: SoundWaveOutcome) => void>();

export function subscribeSoundWaveOutcomes(
  listener: (outcome: SoundWaveOutcome) => void,
): () => void {
  outcomeListeners.add(listener);
  return () => outcomeListeners.delete(listener);
}

export function publishSoundWaveOutcome(
  eventType: SoundWaveEvent,
  scTrackId: string,
  positionPct?: number,
): void {
  if (!scTrackId) return;
  for (const listener of outcomeListeners) {
    try {
      listener({ eventType, scTrackId, positionPct });
    } catch {
      // Outcome observers must never break playback or the network recorder.
    }
  }
}

/**
 * Fire-and-forget event recorder for SoundWave taste model.
 * `positionPct` (0..1) only meaningful for `skip` and `full_play` — backend uses
 * it to split skips into early/mid/late buckets with different negative weight.
 */
export function recordEvent(
  eventType: SoundWaveEvent,
  scTrackId: string,
  positionPct?: number,
  track?: Track | null,
): void {
  if (!scTrackId) return;
  // Privacy-safe personalization always remains local. Network telemetry keeps
  // obeying backend.config.json and is still disabled by default.
  recordLocalRecommendationEvent(eventType, scTrackId, positionPct, track);
  publishSoundWaveOutcome(eventType, scTrackId, positionPct);
  recordNetworkRecommendationEvent(eventType, scTrackId, positionPct);
}

/** Network-only half used by reversible optimistic like/dislike transitions. */
export function recordNetworkRecommendationEvent(
  eventType: SoundWaveEvent,
  scTrackId: string,
  positionPct?: number,
): void {
  if (!scTrackId) return;
  if (!SEND_BEHAVIORAL_DATA) return;
  const scUserId = useAuthStore.getState().user?.urn;
  if (!scUserId) return;

  const body: Record<string, unknown> = { scUserId, scTrackId, eventType };
  if (positionPct != null && Number.isFinite(positionPct)) {
    body.positionPct = Math.max(0, Math.min(1, positionPct));
  }

  api('/events', {
    method: 'POST',
    body: JSON.stringify(body),
  }).catch(() => {});
}
