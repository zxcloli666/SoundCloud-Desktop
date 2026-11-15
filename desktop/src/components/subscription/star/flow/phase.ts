import type { OrderStatusId } from '../../../../lib/pay-client';

export type PayPhase = 'waiting' | 'granted' | 'failed';

export function phaseOf(status: OrderStatusId | undefined): PayPhase {
  if (status === 'granted') return 'granted';
  if (status === 'failed' || status === 'expired' || status === 'refunded') return 'failed';
  return 'waiting';
}
