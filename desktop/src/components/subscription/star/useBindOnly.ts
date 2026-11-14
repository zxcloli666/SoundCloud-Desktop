import { useCallback, useState } from 'react';
import { refreshBinds } from '../../../lib/boosty-binds';
import type { BoostyMethod } from '../../../lib/pay-client';
import type { TrialOutcome } from '../../../lib/star-trial';
import type { Step } from './meta';

export interface BindOnly {
  method: BoostyMethod;
  trial: boolean;
}

export function useBindOnly(
  step: Step,
  setStep: (step: Step) => void,
  onTrial: (outcome: TrialOutcome | null) => void,
) {
  const [bindOnly, setBindOnly] = useState<BindOnly | null>(null);
  const linking = step === 'card' || step === 'sbp' ? bindOnly : null;

  const start = useCallback(
    (method: BoostyMethod, trial: boolean) => {
      setBindOnly({ method, trial });
      setStep(method === 'sbp' ? 'sbp' : 'card');
    },
    [setStep],
  );

  const end = useCallback(
    (outcome: TrialOutcome | null) => {
      setBindOnly(null);
      refreshBinds();
      if (bindOnly?.trial) onTrial(outcome);
      else setStep('manage');
    },
    [bindOnly, onTrial, setStep],
  );

  const leave = useCallback(() => {
    setBindOnly(null);
    refreshBinds();
    setStep(bindOnly?.trial ? 'trial' : 'manage');
  }, [bindOnly, setStep]);

  const clear = useCallback(() => setBindOnly(null), []);

  return { linking, start, end, leave, clear };
}
