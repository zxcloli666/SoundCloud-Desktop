import type {
  BoostyGranted,
  BoostyMethod,
  BoostyStep,
  PaySubscription,
  Renewal,
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
};

const CARD_METHODS: BoostyMethod[] = ['card', 'card_usd'];

export function trialRefusal(code: string | null | undefined): TrialRefusal | null {
  return code ? (REFUSALS[code] ?? null) : null;
}

function reasonOf(code: string | null | undefined): TrialReason {
  return trialRefusal(code) ?? 'no_methods';
}

export function trialOffer(
  sub: PaySubscription | undefined,
  cardSupported: boolean,
): TrialOffer | null {
  const trial = sub?.trial;
  if (!trial) return null;
  const methods = (trial.methods ?? []).filter(
    (m) => m === 'sbp' || (CARD_METHODS.includes(m) && cardSupported),
  );
  const available = trial.available && methods.length > 0;
  return {
    available,
    days: trial.days,
    methods,
    reason: available ? null : reasonOf(trial.reason),
    active: trial.active ?? null,
  };
}

export function isGranted(start: object): start is BoostyGranted {
  return 'status' in start && start.status === 'granted';
}

export function trialOutcome(
  step: Pick<BoostyStep, 'trial' | 'trial_refused'>,
): TrialOutcome | null {
  if (step.trial) return { kind: 'granted', grant: step.trial };
  const refusal = trialRefusal(step.trial_refused);
  return refusal ? { kind: 'refused', refusal } : null;
}

export function trialRenewal(sub: PaySubscription): Renewal | null {
  const active = sub.trial?.active;
  if (!active) return sub.renewal ?? null;
  const base = sub.renewal ?? {
    source: 'boosty_card',
    amount: active.amount_minor,
    currency: active.currency,
    period_days: 30,
    method: active.method,
  };
  return { ...base, at: active.charge_at };
}
