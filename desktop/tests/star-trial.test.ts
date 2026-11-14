import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PaySubscription, TrialOffer } from '../src/lib/pay-client.ts';
import {
  isGranted,
  trialOffer,
  trialOutcome,
  trialRefusal,
  trialRenewal,
} from '../src/lib/star-trial.ts';

const GRANT = {
  ends_at: 1_800_259_200,
  charge_at: 1_800_259_200,
  amount_minor: 149,
  currency: 'RUB',
};

function sub(trial?: TrialOffer, extra: Partial<PaySubscription> = {}): PaySubscription {
  return {
    premium: false,
    premium_until: 0,
    entitlements: [],
    discord: null,
    ...(trial ? { trial } : {}),
    ...extra,
  } as PaySubscription;
}

const OFFER: TrialOffer = {
  available: true,
  days: 3,
  methods: ['card', 'sbp', 'card_usd'],
  reason: null,
  active: null,
};

test('an older pay without trial offers no trial', () => {
  assert.equal(trialOffer(sub(), true), null);
  assert.equal(trialOffer(undefined, true), null);
});

test('the offer keeps only methods this client can link', () => {
  assert.deepEqual(trialOffer(sub(OFFER), true)?.methods, ['card', 'sbp', 'card_usd']);
  const noKeys = trialOffer(sub(OFFER), false);
  assert.deepEqual(noKeys?.methods, ['sbp']);
  assert.equal(noKeys?.available, true);
  const cardsOnly = trialOffer(sub({ ...OFFER, methods: ['card'] }), false);
  assert.equal(cardsOnly?.available, false);
  assert.equal(cardsOnly?.reason, 'no_methods');
});

test('an unavailable offer names why', () => {
  assert.equal(
    trialOffer(sub({ ...OFFER, available: false, reason: 'device_used' }), true)?.reason,
    'device_used',
  );
  assert.equal(
    trialOffer(sub({ ...OFFER, available: false, reason: null }), true)?.reason,
    'no_methods',
  );
  assert.equal(trialOffer(sub({ ...OFFER, methods: [] }), true)?.available, false);
});

test('start and step codes map to one refusal each', () => {
  assert.equal(trialRefusal('trial_used'), 'used');
  assert.equal(trialRefusal('trial_has_star'), 'has_star');
  assert.equal(trialRefusal('trial_device_used'), 'device_used');
  assert.equal(trialRefusal('card_used'), 'card_used');
  assert.equal(trialRefusal('trial_needs_bind'), null);
  assert.equal(trialRefusal(null), null);
});

test('a start with a usable link is granted without a session', () => {
  assert.equal(isGranted({ status: 'granted', trial: GRANT }), true);
  assert.equal(isGranted({ session_id: 7, method: 'sbp', expires_at: 1 }), false);
});

test('a bound step carries the trial or why it was refused', () => {
  assert.deepEqual(trialOutcome({ trial: GRANT }), { kind: 'granted', grant: GRANT });
  assert.deepEqual(trialOutcome({ trial_refused: 'card_used' }), {
    kind: 'refused',
    refusal: 'card_used',
  });
  assert.equal(trialOutcome({}), null);
  assert.equal(trialOutcome({ trial_refused: 'something_new' }), null);
});

test('during a trial the renewal date is the trial charge date', () => {
  const active = { ...GRANT, method: 'sbp' as const, charge_at: 1_800_300_000 };
  const renewal = {
    source: 'boosty_card',
    at: 1_800_259_200,
    amount: 149,
    currency: 'RUB',
    period_days: 30,
  };
  assert.equal(trialRenewal(sub({ ...OFFER, active }, { renewal }))?.at, 1_800_300_000);
  const alone = trialRenewal(sub({ ...OFFER, active }));
  assert.equal(alone?.at, 1_800_300_000);
  assert.equal(alone?.amount, 149);
  assert.equal(alone?.method, 'sbp');
  assert.equal(trialRenewal(sub(OFFER, { renewal })), renewal);
  assert.equal(trialRenewal(sub()), null);
});
