import type { BoostyStep } from '../pay-client';

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
};

export function verdictFailure(reason: string): FailReason {
  return FAILURE_OF_REASON[reason] ?? 'declined';
}

export function stepEnd({ status, reason }: BoostyStep): 'bound' | FailReason | null {
  if (status === 'bound') return 'bound';
  if (status === 'expired') return 'timeout';
  if (status === 'failed') return verdictFailure(reason ?? '');
  return null;
}
