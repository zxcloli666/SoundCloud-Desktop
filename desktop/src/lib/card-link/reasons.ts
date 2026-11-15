import type { BindStep } from '../pay-client';

export type FailReason =
  | 'busy'
  | 'unavailable'
  | 'bundle'
  | 'declined'
  | 'closed'
  | 'expired'
  | 'inUse'
  | 'page'
  | 'timeout'
  | 'network';

const FAILURE_OF_REASON: Record<string, FailReason> = {
  closed: 'closed',
  capture_timeout: 'expired',
  card_in_use: 'inUse',
  aborted: 'closed',
  bad_page: 'page',
};

export function verdictFailure(reason: string): FailReason {
  return FAILURE_OF_REASON[reason] ?? 'declined';
}

export function stepEnd({ state, reason }: BindStep): 'linked' | FailReason | null {
  if (state === 'linked') return 'linked';
  if (state === 'expired') return 'timeout';
  if (state === 'failed') return verdictFailure(reason ?? '');
  return null;
}
