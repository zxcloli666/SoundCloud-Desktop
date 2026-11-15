import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { type OrderStatusId, payApi } from './pay-client';
import { requestPremiumRecheck } from './premium-cache';

const POLL_MS = 2500;
const TERMINAL = new Set<OrderStatusId>(['granted', 'failed', 'expired', 'refunded']);

/**
 * Poll a checkout order until it reaches a terminal status. On `granted` it
 * triggers an app-wide premium recheck so the rest of the UI unlocks. Stops once
 * the order's TTL (`expiresAt`, unix secs) has passed — no point polling a dead
 * order; a real late payment is still honored server-side via the webhook.
 */
export function useOrderPoll(orderId: string | null, expiresAt?: number | null) {
  const query = useQuery({
    queryKey: ['pay', 'order', orderId],
    queryFn: () => payApi.order(orderId as string),
    enabled: !!orderId,
    refetchInterval: (q) => {
      if (q.state.data && TERMINAL.has(q.state.data.status)) return false;
      // +5s grace so we get one last poll right after the deadline.
      if (expiresAt && Date.now() / 1000 > expiresAt + 5) return false;
      return POLL_MS;
    },
    staleTime: 0,
    gcTime: 0,
  });

  const status = query.data?.status;
  useEffect(() => {
    if (status === 'granted') requestPremiumRecheck();
  }, [status]);

  return query;
}
