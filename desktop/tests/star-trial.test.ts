import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BindStart, PaySubscription, TrialOffer } from '../src/lib/pay-client.ts';
import { isGranted, trialOffer, trialOutcome, trialRefusal } from '../src/lib/star-trial.ts';

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
  methods: ['card_ru', 'sbp', 'card_intl'],
  reason: null,
  active: null,
};

test('an older pay without trial offers no trial', () => {
  assert.equal(trialOffer(sub()), null);
  assert.equal(trialOffer(undefined), null);
});

test('an unavailable offer names why', () => {
  assert.equal(
    trialOffer(sub({ ...OFFER, available: false, reason: 'device_used' }))?.reason,
    'device_used',
  );
  assert.equal(trialOffer(sub({ ...OFFER, available: false, reason: null }))?.reason, 'no_methods');
  assert.equal(trialOffer(sub({ ...OFFER, methods: [] }))?.available, false);
});

test('start and step codes map to one refusal each', () => {
  assert.equal(trialRefusal('trial_used'), 'used');
  assert.equal(trialRefusal('trial_has_star'), 'has_star');
  assert.equal(trialRefusal('trial_device_used'), 'device_used');
  assert.equal(trialRefusal('card_used'), 'card_used');
  assert.equal(trialRefusal('trial_card_used'), 'card_used');
  assert.equal(trialRefusal('trial_disabled'), null);
  assert.equal(trialRefusal('trial_needs_bind'), null);
  assert.equal(trialRefusal(null), null);
});

test('a start with a usable link is granted without a session', () => {
  assert.equal(isGranted({ api: 2, state: 'granted', trial: GRANT } as BindStart), true);
  assert.equal(isGranted({ api: 2, state: 'open', session_id: 7 } as unknown as BindStart), false);
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
