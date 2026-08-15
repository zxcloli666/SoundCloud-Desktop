import { useAuthStore } from '../stores/auth';
import { api } from './api';
import { SEND_BEHAVIORAL_DATA } from './constants';

export type SoundWaveEvent =
  | 'like'
  | 'local_like'
  | 'playlist_add'
  | 'full_play'
  | 'skip'
  | 'dislike';

/**
 * Fire-and-forget event recorder for SoundWave taste model.
 * `positionPct` (0..1) only meaningful for `skip` and `full_play` — backend uses
 * it to split skips into early/mid/late buckets with different negative weight.
 */
export function recordEvent(
  eventType: SoundWaveEvent,
  scTrackId: string,
  positionPct?: number,
): void {
  if (!SEND_BEHAVIORAL_DATA) return;
  if (!scTrackId) return;
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
