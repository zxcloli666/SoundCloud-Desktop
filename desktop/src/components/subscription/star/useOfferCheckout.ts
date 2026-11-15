import { useCallback, useMemo } from 'react';
import type { PayMethod, Plan } from '../../../lib/pay-client';
import { usePersonalOffer } from '../../../lib/personal-offer';

export function useOfferCheckout(offerId: string | null, solo: boolean) {
  const current = usePersonalOffer();
  const offer = offerId && solo && current?.id === offerId ? current : null;

  const plans = useCallback(
    (all: Plan[]): Plan[] =>
      offer
        ? all
            .filter((p) => p.id === offer.plan_id)
            .map((p) => ({ ...p, price: offer.price, savings_pct: 0 }))
        : all,
    [offer],
  );

  const methods = useCallback(
    (all: PayMethod[]): PayMethod[] =>
      offer?.requires_bind
        ? all.filter((m) => m.bind && m.renew_plans.includes(offer.plan_id))
        : all,
    [offer],
  );

  return useMemo(
    () => ({ offer, bind: offer?.requires_bind === true, plans, methods }),
    [offer, plans, methods],
  );
}
