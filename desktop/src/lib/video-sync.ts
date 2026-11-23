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

export type ParkStep = 'wait' | 'play' | 'again';

export const LEAD_MIN_SEC = 0.15;
const LEAD_MAX_SEC = 4;
const LEAD_PART = 0.8;
const PARK_EARLY_SEC = 0.03;
const PARK_PATIENCE_SEC = 8;

export function parkStep(target: number, aim: number, canPlay: boolean): ParkStep {
  const late = target - aim;
  if (late < -PARK_EARLY_SEC) return 'wait';
  if (canPlay) return late <= DRIFT_JUMP_SEC ? 'play' : 'again';
  return late < PARK_PATIENCE_SEC ? 'wait' : 'again';
}

export function leadFor(tookSec: number): number {
  return Math.min(Math.max(tookSec * LEAD_PART, LEAD_MIN_SEC), LEAD_MAX_SEC);
}
