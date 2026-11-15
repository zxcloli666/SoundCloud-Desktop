import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  chooseRoute,
  currencyOf,
  payMethods,
  type RouteContext,
  renewable,
  usable,
} from '../src/components/subscription/methods.ts';
import type { PayMethod, PlansResponse } from '../src/lib/pay-client.ts';

function method(over: Partial<PayMethod> & Pick<PayMethod, 'id'>): PayMethod {
  return {
    tag: 'ru',
    currency: 'RUB',
    flow: 'open',
    bind: null,
    renew_plans: [],
    period_days: null,
    gift: true,
    shared: true,
    ...over,
  };
}

const SBP = method({
  id: 'sbp',
  flow: 'qr',
  bind: { flow: 'qr', currency: 'RUB' },
  renew_plans: ['m1'],
  period_days: 30,
});
const CARD_RU = method({
  id: 'card_ru',
  bind: { flow: 'card_form', currency: 'RUB' },
  renew_plans: ['m1'],
  period_days: 30,
});
const CARD_INTL = method({
  id: 'card_intl',
  tag: 'world',
  currency: 'USD',
  flow: 'charge',
  bind: { flow: 'card_form', currency: 'USD' },
  renew_plans: ['m1'],
  period_days: 30,
  gift: false,
  shared: false,
});
const CRYPTO = method({ id: 'crypto', tag: 'world' });
const STARS = method({
  id: 'stars',
  tag: 'world',
  currency: 'XTR',
  renew_plans: ['m1'],
  period_days: 30,
});

const PLANS = {
  api: 2,
  plans: [],
  shared: [],
  methods: [STARS, CRYPTO, CARD_INTL, CARD_RU, SBP],
} as PlansResponse;

const SOLO: RouteContext = { planId: 'm1', gift: false, shared: false };

test('methods come in a fixed order whatever order pay sends', () => {
  assert.deepEqual(
    payMethods(PLANS).map((m) => m.id),
    ['sbp', 'card_ru', 'card_intl', 'crypto', 'stars'],
  );
});

test('the toggle picks renew through the bind, off picks the one-off flow', () => {
  assert.deepEqual(chooseRoute(SBP, true, SOLO), { method: SBP, recurring: true, viaBind: true });
  assert.deepEqual(chooseRoute(SBP, false, SOLO), {
    method: SBP,
    recurring: false,
    viaBind: false,
  });
  assert.deepEqual(chooseRoute(STARS, true, SOLO), {
    method: STARS,
    recurring: true,
    viaBind: false,
  });
  assert.deepEqual(chooseRoute(CRYPTO, true, SOLO), {
    method: CRYPTO,
    recurring: false,
    viaBind: false,
  });
});

test('renew needs a plan from renew_plans, no gift, and a personal plan for binds', () => {
  for (const ctx of [
    { ...SOLO, planId: 'm3' },
    { ...SOLO, planId: null },
    { ...SOLO, gift: true },
    { ...SOLO, shared: true },
  ]) {
    assert.equal(renewable(SBP, ctx), false, JSON.stringify(ctx));
  }
  assert.equal(renewable(STARS, { ...SOLO, shared: true }), true);
});

test('a bind-only method links a card even for a one-off year', () => {
  const year = { ...SOLO, planId: 'm12' };
  assert.deepEqual(chooseRoute(CARD_INTL, false, year), {
    method: CARD_INTL,
    recurring: false,
    viaBind: true,
  });
  assert.equal(chooseRoute(CARD_INTL, null, SOLO).recurring, true);
  assert.equal(usable(CARD_INTL, year), true);
});

test('gift and shared flags hide a method', () => {
  assert.equal(usable(CARD_INTL, { ...SOLO, gift: true }), false);
  assert.equal(usable(CARD_INTL, { ...SOLO, shared: true }), false);
  assert.equal(usable(CRYPTO, { ...SOLO, gift: true }), true);
  assert.equal(usable(method({ id: 'card_intl', flow: 'charge' }), SOLO), false);
});

test('the price currency follows the bind on a bind route', () => {
  assert.equal(currencyOf(chooseRoute(CARD_INTL, true, SOLO)), 'USD');
  assert.equal(currencyOf(chooseRoute(STARS, true, SOLO)), 'XTR');
  assert.equal(
    currencyOf(
      chooseRoute(
        method({
          id: 'card_ru',
          bind: { flow: 'card_form', currency: 'USD' },
          renew_plans: ['m1'],
        }),
        true,
        SOLO,
      ),
    ),
    'USD',
  );
  assert.equal(currencyOf(null), 'RUB');
});
