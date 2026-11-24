const RESTART_AFTER_SECS = 3;

export function restartsOnPrev(position: number, audibleFrom: number): boolean {
  return position - audibleFrom > RESTART_AFTER_SECS;
}
