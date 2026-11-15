import { useCallback, useState } from 'react';
import type { MethodId, PayMethod, Plan } from '../../../../lib/pay-client';
import { planPrice } from '../../../../lib/star-format';
import { refreshSubscription, usePaySubscription } from '../../../../lib/star-offer';
import { type TrialBlock, type TrialOutcome, trialOffer } from '../../../../lib/star-trial';
import type { Step } from '../meta';

const TRIAL_PLAN = 'm1';

export function useTrialStep(
  premium: boolean,
  plans: Plan[],
  methods: PayMethod[],
  setStep: (step: Step) => void,
  onGranted: () => void,
) {
  const sub = usePaySubscription();
  const offer = premium ? null : trialOffer(sub.data);
  const [picked, setPicked] = useState<MethodId | null>(null);
  const [blocked, setBlocked] = useState<TrialBlock | null>(null);
  const method = picked && offer?.methods.includes(picked) ? picked : (offer?.methods[0] ?? null);
  const plan = plans.find((p) => p.id === TRIAL_PLAN);
  const currency = methods.find((m) => m.id === method)?.bind?.currency ?? 'RUB';
  const amount = plan && method ? planPrice(plan, currency) : '';

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
