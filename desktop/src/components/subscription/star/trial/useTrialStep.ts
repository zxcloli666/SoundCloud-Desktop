import { usePlans } from '../../../../lib/binds';
import { usePremium } from '../../../../lib/premium-cache';
import { planPrice } from '../../../../lib/star-format';
import { usePaySubscription } from '../../../../lib/star-offer';
import { trialOffer } from '../../../../lib/star-trial';
import { isGift, useFlow } from '../flow/store';

const TRIAL_PLAN = 'm1';

export function useTrialStep() {
  const premium = usePremium();
  const sub = usePaySubscription();
  const plans = usePlans().data;
  const picked = useFlow((s) => s.trialMethod);
  const refused = useFlow((s) => s.trialBlocked);
  const offer = premium ? null : trialOffer(sub.data);
  const method = picked && offer?.methods.includes(picked) ? picked : (offer?.methods[0] ?? null);
  const plan = plans?.plans.find((p) => p.id === TRIAL_PLAN);
  const currency = plans?.methods.find((m) => m.id === method)?.bind?.currency ?? 'RUB';
  return {
    offer,
    loading: sub.isLoading,
    method,
    currency,
    amount: plan && method ? planPrice(plan, currency) : '',
    blocked: refused ?? (offer && !offer.available ? offer.reason : null),
  };
}

export function useTrialDays(): number | null {
  const premium = usePremium();
  const sub = usePaySubscription(!premium).data;
  const eligible = useFlow((s) => !isGift(s) && s.tier === 'solo');
  const offer = premium || !eligible ? null : trialOffer(sub);
  return offer?.available ? offer.days : null;
}
