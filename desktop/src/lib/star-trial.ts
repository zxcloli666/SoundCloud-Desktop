import type {
  BindGranted,
  BindStart,
  BindStep,
  PaySubscription,
  TrialGrant,
  TrialOffer,
  TrialReason,
  TrialRefusal,
} from './pay-client';

export type TrialOutcome =
  | { kind: 'granted'; grant: TrialGrant }
  | { kind: 'refused'; refusal: TrialRefusal };

export type TrialBlock = TrialReason | 'failed';

const REFUSALS: Record<string, TrialRefusal> = {
  used: 'used',
  trial_used: 'used',
  has_star: 'has_star',
  trial_has_star: 'has_star',
  device_used: 'device_used',
  trial_device_used: 'device_used',
  card_used: 'card_used',
  trial_card_used: 'card_used',
};

export function trialRefusal(code: string | null | undefined): TrialRefusal | null {
  return code ? (REFUSALS[code] ?? null) : null;
}

function reasonOf(code: string | null | undefined): TrialReason {
  return trialRefusal(code) ?? 'no_methods';
}

export function trialOffer(sub: PaySubscription | undefined): TrialOffer | null {
  const trial = sub?.trial;
  if (!trial) return null;
  const available = trial.available && trial.methods.length > 0;
  return {
    available,
    days: trial.days,
    methods: trial.methods,
    reason: available ? null : reasonOf(trial.reason),
    active: trial.active ?? null,
  };
}

export function isGranted(start: BindStart): start is BindGranted {
  return start.state === 'granted';
}

export function trialOutcome(step: Pick<BindStep, 'trial' | 'trial_refused'>): TrialOutcome | null {
  if (step.trial) return { kind: 'granted', grant: step.trial };
  const refusal = trialRefusal(step.trial_refused);
  return refusal ? { kind: 'refused', refusal } : null;
}
