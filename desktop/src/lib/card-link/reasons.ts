import type { BindStep } from '../pay-client';

export type FailReason =
  | 'busy'
  | 'limit'
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

export function startRefusal(status: number, code: string | null): FailReason {
  if (status === 429) return code === 'too_many_attempts' ? 'limit' : 'busy';
  return status === 503 || status === 501 ? 'unavailable' : 'network';
}

export function verdictFailure(reason: string): FailReason {
  return FAILURE_OF_REASON[reason] ?? 'declined';
}

export function stepEnd({ state, reason }: BindStep): 'linked' | FailReason | null {
  if (state === 'linked') return 'linked';
  if (state === 'expired') return 'timeout';
  if (state === 'failed') return verdictFailure(reason ?? '');
  return null;
}

const RESEND = new Set<FailReason>(['timeout', 'network', 'expired', 'closed', 'page', 'busy']);

export function resendable(reason: FailReason): boolean {
  return RESEND.has(reason);
}
