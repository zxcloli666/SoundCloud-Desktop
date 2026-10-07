export const MIN_TRACK_SEC = 30;
const MAX_THRESHOLD_SEC = 240;
const MAX_TICK_STEP_SEC = 1.5;
const RESTART_WINDOW_SEC = 3;
const RESTART_JUMP_SEC = 10;

export function scrobbleThreshold(durationSec: number): number {
  return Math.min(durationSec / 2, MAX_THRESHOLD_SEC);
}

export function isLongEnough(durationSec: number): boolean {
  return durationSec > MIN_TRACK_SEC;
}

export function playedStep(lastPos: number, pos: number): number {
  const step = pos - lastPos;
  return step > 0 && step <= MAX_TICK_STEP_SEC ? step : 0;
}

export function isRestart(lastPos: number, pos: number): boolean {
  return pos <= RESTART_WINDOW_SEC && lastPos - pos >= RESTART_JUMP_SEC;
}
