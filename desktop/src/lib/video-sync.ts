export interface PlaybackClock {
  pos: number;
  at: number;
  rate: number;
  playing: boolean;
}

export type SyncStep =
  | { kind: 'wait' }
  | { kind: 'end' }
  | { kind: 'hold'; rate: number }
  | { kind: 'nudge'; rate: number }
  | { kind: 'jump'; time: number; rate: number };

export const VIDEO_LEAD_MS = 0;
export const SYNC_EVERY_MS = 500;
export const DRIFT_HOLD_SEC = 0.15;
export const DRIFT_SETTLED_SEC = 0.04;
export const DRIFT_JUMP_SEC = 0.5;
export const NUDGE = 0.05;

export function clockTime(clock: PlaybackClock, now: number): number {
  if (!clock.playing) return clock.pos;
  return clock.pos + (Math.max(0, now - clock.at) / 1000) * clock.rate;
}

export function videoTarget(audioSec: number, offsetMs: number): number {
  return audioSec + (offsetMs + VIDEO_LEAD_MS) / 1000;
}

export function syncStep(
  target: number,
  current: number,
  duration: number,
  rate: number,
  nudging = false,
): SyncStep {
  if (target < 0) return { kind: 'wait' };
  if (Number.isFinite(duration) && duration > 0 && target >= duration) return { kind: 'end' };
  const drift = current - target;
  const size = Math.abs(drift);
  const hold = nudging ? DRIFT_SETTLED_SEC : DRIFT_HOLD_SEC;
  if (size <= hold) return { kind: 'hold', rate };
  if (size <= DRIFT_JUMP_SEC) {
    return { kind: 'nudge', rate: rate * (drift > 0 ? 1 - NUDGE : 1 + NUDGE) };
  }
  return { kind: 'jump', time: target, rate };
}
