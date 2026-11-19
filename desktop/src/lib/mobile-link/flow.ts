import type { LinkStatus } from './api';

export type Phase =
  | 'starting'
  | 'waiting'
  | 'received'
  | 'completed'
  | 'mismatch'
  | 'failed'
  | 'expired';

export const LINK_TTL_MS = 15 * 60_000;
export const POLL_MS = 2_000;
export const FAST_POLL_MS = 700;

const FINAL: ReadonlySet<Phase> = new Set(['completed', 'mismatch', 'failed', 'expired']);

export const isFinal = (phase: Phase) => FINAL.has(phase);

export function phaseOfStatus(current: Phase, status: LinkStatus): Phase {
  if (isFinal(current)) return current;
  switch (status) {
    case 'completed':
      return 'completed';
    case 'account_mismatch':
      return 'mismatch';
    case 'failed':
      return 'failed';
    case 'expired':
      return 'expired';
    case 'processing':
      return 'received';
    case 'pending':
      return current;
  }
}

export function minutesLeft(startedAt: number, now: number): number {
  return Math.max(0, Math.ceil((startedAt + LINK_TTL_MS - now) / 60_000));
}

export function wasSeen(seen: Set<string>, state: string): boolean {
  if (seen.has(state)) return true;
  seen.add(state);
  return false;
}

export function acceptsCallback(phase: Phase): boolean {
  return phase === 'waiting';
}

const STEPS: Partial<Record<Phase, number>> = {
  starting: 0,
  waiting: 0,
  received: 1,
  completed: 2,
};

export function reachedStep(reached: number, phase: Phase): number {
  return Math.max(reached, STEPS[phase] ?? 0);
}

export function pollDelay(phase: Phase): number {
  return phase === 'received' ? FAST_POLL_MS : POLL_MS;
}
