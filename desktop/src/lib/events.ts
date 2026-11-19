import { useAuthStore } from '../stores/auth';
import { api } from './api';
import { isLocalUrn } from './local-library';
import { noteWaveOutcome } from './wave-feedback';

export type SoundWaveEvent =
  | 'like'
  | 'local_like'
  | 'playlist_add'
  | 'full_play'
  | 'skip'
  | 'dislike';

const LANDING_WAIT_MS = 2000;
const SEEK_DEBOUNCE_MS = 700;
const SEEK_MAX_MS = 24 * 60 * 60 * 1000;
const SEEK_REJECTED = [400, 404, 415, 422];
const inFlight = new Set<Promise<void>>();

export function recordEvent(
  eventType: SoundWaveEvent,
  scTrackId: string,
  positionPct?: number,
): void {
  if (!scTrackId || isLocalUrn(scTrackId)) return;
  const scUserId = useAuthStore.getState().user?.urn;
  if (!scUserId) return;

  const body: Record<string, unknown> = { scUserId, scTrackId, eventType };
  const position =
    positionPct != null && Number.isFinite(positionPct)
      ? Math.max(0, Math.min(1, positionPct))
      : undefined;
  if (position !== undefined) body.positionPct = position;
  noteWaveOutcome(eventType, scTrackId, position);

  trackTasteWrite(
    api('/events', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  ).catch(() => {});
}

export type SeekSource = 'player' | 'moment';

interface PendingSeek {
  trackUrn: string;
  fromMs: number;
  positionMs: number;
  source: SeekSource;
}

let pendingSeek: PendingSeek | null = null;
let seekTimer: ReturnType<typeof setTimeout> | null = null;

export function recordSeek(
  trackUrn: string,
  positionMs: number,
  fromMs: number,
  source: SeekSource,
): void {
  if (!trackUrn || isLocalUrn(trackUrn)) return;
  if (!Number.isFinite(positionMs) || !Number.isFinite(fromMs)) return;
  const position = clampSeekMs(positionMs);
  if (pendingSeek && (pendingSeek.trackUrn !== trackUrn || pendingSeek.source !== source)) {
    flushSeek();
  }
  if (pendingSeek) pendingSeek.positionMs = position;
  else
    pendingSeek = {
      trackUrn,
      fromMs: clampSeekMs(fromMs),
      positionMs: position,
      source,
    };
  if (seekTimer) clearTimeout(seekTimer);
  seekTimer = setTimeout(flushSeek, SEEK_DEBOUNCE_MS);
}

function clampSeekMs(ms: number): number {
  return Math.min(SEEK_MAX_MS, Math.max(0, Math.round(ms)));
}

function flushSeek(): void {
  if (seekTimer) clearTimeout(seekTimer);
  seekTimer = null;
  const seek = pendingSeek;
  pendingSeek = null;
  if (!seek || seek.positionMs === seek.fromMs) return;
  if (!useAuthStore.getState().user?.urn) return;
  trackTasteWrite(
    api('/events', {
      method: 'POST',
      body: JSON.stringify({
        eventType: 'seek',
        scTrackId: seek.trackUrn,
        positionMs: seek.positionMs,
        fromMs: seek.fromMs,
        source: seek.source,
      }),
      quiet: true,
      silentStatuses: SEEK_REJECTED,
    }),
  ).catch(() => {});
}

export function trackTasteWrite<T>(request: Promise<T>): Promise<T> {
  const landed = request.then(
    () => {},
    () => {},
  );
  inFlight.add(landed);
  void landed.then(() => inFlight.delete(landed));
  return request;
}

export async function tasteWritesLanded(): Promise<void> {
  if (inFlight.size === 0) return;
  await Promise.race([
    Promise.all(inFlight),
    new Promise((resolve) => setTimeout(resolve, LANDING_WAIT_MS)),
  ]);
}
