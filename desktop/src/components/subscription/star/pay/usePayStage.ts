import { useEffect, useState } from 'react';
import type { Order, OrderAction } from '../../../../lib/pay-client';
import { usePassed } from '../../../../lib/tick';
import type { PayPhase } from '../flow/phase';

const QR_REFRESHES = 3;
const KNOWN_REASONS = ['declined', 'relink', 'aborted', 'expired', 'confirm_closed'];

export type PayStageView =
  | { kind: 'refreshing' }
  | { kind: 'failed'; reason: string | null; relink: boolean }
  | { kind: 'confirm'; action: Extract<OrderAction, { type: 'confirm' }> }
  | { kind: 'wait'; charging: boolean }
  | { kind: 'qr'; action: Extract<OrderAction, { type: 'qr' }> }
  | { kind: 'open'; action: Extract<OrderAction, { type: 'open' }> }
  | { kind: 'none' };

export function usePayStage(
  first: Order,
  order: Order,
  phase: PayPhase,
  onRefresh: () => void,
): PayStageView {
  const action = phase === 'waiting' ? order.action : null;
  const timed = action?.type === 'qr' || action?.type === 'open';
  const expired = usePassed(timed ? order.expires_at : null);
  const [refreshes, setRefreshes] = useState(0);
  const willRefresh =
    first.action?.type === 'qr' && (expired || phase === 'failed') && refreshes < QR_REFRESHES;

  useEffect(() => {
    if (!willRefresh) return;
    setRefreshes((n) => n + 1);
    onRefresh();
  }, [willRefresh, onRefresh]);

  if (willRefresh) return { kind: 'refreshing' };
  if (phase === 'failed' || expired) {
    const reason = expired ? 'expired' : (order.reason ?? '');
    return {
      kind: 'failed',
      reason: KNOWN_REASONS.includes(reason) ? reason : null,
      relink: reason === 'relink',
    };
  }
  if (action?.type === 'confirm') return { kind: 'confirm', action };
  if (action?.type === 'wait' || (!action && phase === 'waiting')) {
    return { kind: 'wait', charging: !!action };
  }
  if (action?.type === 'qr') return { kind: 'qr', action };
  if (action?.type === 'open') return { kind: 'open', action };
  return { kind: 'none' };
}
