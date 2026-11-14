import { useCallback, useState } from 'react';
import { useCardSupported } from '../../../../lib/boosty-binds';
import type { BoostyMethod, Plan } from '../../../../lib/pay-client';
import { planPrice } from '../../../../lib/star-format';
import { refreshSubscription, usePaySubscription } from '../../../../lib/star-offer';
import { type TrialBlock, type TrialOutcome, trialOffer } from '../../../../lib/star-trial';
import { bindCurrency } from '../../providers';
import type { Step } from '../meta';

const TRIAL_PLAN = 'm1';

export function useTrialStep(
  premium: boolean,
  plans: Plan[],
  setStep: (step: Step) => void,
  onGranted: () => void,
) {
  const sub = usePaySubscription();
  const cardSupported = useCardSupported();
  const offer = premium ? null : trialOffer(sub.data, cardSupported);
  const [picked, setPicked] = useState<BoostyMethod | null>(null);
  const [blocked, setBlocked] = useState<TrialBlock | null>(null);
  const method = picked && offer?.methods.includes(picked) ? picked : (offer?.methods[0] ?? null);
  const plan = plans.find((p) => p.id === TRIAL_PLAN);
  const amount = plan && method ? planPrice(plan, bindCurrency(method)) : '';

  const open = useCallback(() => {
    setBlocked(null);
    setStep('trial');
  }, [setStep]);

  const done = useCallback(
    (outcome: TrialOutcome | null) => {
      refreshSubscription();
      if (outcome?.kind === 'granted') return onGranted();
      setBlocked(outcome?.kind === 'refused' ? outcome.refusal : 'failed');
      setStep('trial');
    },
    [onGranted, setStep],
  );

  return {
    offer,
    loading: sub.isLoading,
    method,
    pick: setPicked,
    amount,
    blocked: blocked ?? (offer && !offer.available ? offer.reason : null),
    open,
    done,
  };
}
