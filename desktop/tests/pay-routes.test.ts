import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  activationOptions,
  bindOf,
  chooseRoute,
  currencyOf,
  type RouteContext,
  toCheckout,
  usable,
} from '../src/components/subscription/providers.ts';
import type { PlansResponse } from '../src/lib/pay-client.ts';

const PLANS = {
  monthly_rub: 149,
  plans: [],
  providers: {},
  methods: { platega: [] },
  routes: [
    {
      method: 'stars',
      once: { provider: 'tgstars', method: 'stars' },
      renew: { provider: 'tgstars', method: 'stars', plans: ['m1'], period_days: 30 },
    },
    { method: 'crypto', once: { provider: 'cryptobot', method: 'crypto' }, renew: null },
    {
      method: 'sbp',
      once: { provider: 'platega', method: 'sbp' },
      renew: { provider: 'boostycard', method: 'sbp', plans: ['m1'], period_days: 30 },
    },
    {
      method: 'card_ru',
      once: { provider: 'platega', method: 'card_ru' },
      renew: { provider: 'boostycard', method: 'card', plans: ['m1'], period_days: 30 },
    },
    { method: 'card_intl', once: { provider: 'platega', method: 'card_intl' }, renew: null },
    { method: 'paypal', once: { provider: 'platega', method: 'paypal' }, renew: null },
  ],
} as unknown as PlansResponse;

const SOLO: RouteContext = { planId: 'm1', gift: false, shared: false, cardSupported: true };

function option(method: string) {
  const found = activationOptions(PLANS).find((o) => o.method === method);
  assert.ok(found, method);
  return found;
}

test('methods come in a fixed order and unknown ones are skipped', () => {
  assert.deepEqual(
    activationOptions(PLANS).map((o) => o.kind),
    ['sbp', 'card_ru', 'card_intl', 'crypto_bot', 'tgstars'],
  );
  assert.deepEqual(activationOptions({ ...PLANS, routes: undefined }), []);
});

test('crypto through platega looks like on-chain crypto', () => {
  const plans = {
    ...PLANS,
    routes: [{ method: 'crypto', once: { provider: 'platega', method: 'crypto' }, renew: null }],
  } as PlansResponse;
  assert.equal(activationOptions(plans)[0].kind, 'crypto_platega');
});

test('the toggle picks the renew route, off picks the one-off route', () => {
  assert.deepEqual(chooseRoute(option('sbp'), true, SOLO), {
    route: PLANS.routes?.[2].renew,
    recurring: true,
  });
  assert.deepEqual(chooseRoute(option('sbp'), false, SOLO), {
    route: { provider: 'platega', method: 'sbp' },
    recurring: false,
  });
  assert.deepEqual(chooseRoute(option('card_intl'), true, SOLO), {
    route: { provider: 'platega', method: 'card_intl' },
    recurring: false,
  });
});

test('renew needs a plan from its list, no gift, and a personal plan for binds', () => {
  const sbp = option('sbp');
  for (const ctx of [
    { ...SOLO, planId: 'm3' },
    { ...SOLO, planId: null },
    { ...SOLO, gift: true },
    { ...SOLO, shared: true },
  ]) {
    assert.equal(chooseRoute(sbp, true, ctx)?.recurring, false, JSON.stringify(ctx));
  }
  assert.equal(chooseRoute(option('stars'), true, { ...SOLO, shared: true })?.recurring, true);
});

test('card renew needs the native card support, sbp does not', () => {
  const noCard = { ...SOLO, cardSupported: false };
  assert.equal(chooseRoute(option('card_ru'), true, noCard)?.recurring, false);
  assert.equal(chooseRoute(option('sbp'), true, noCard)?.recurring, true);
});

test('a renew-only method is forced on and hidden when renew is not allowed', () => {
  const plans = {
    ...PLANS,
    routes: [
      {
        method: 'sbp',
        once: null,
        renew: { provider: 'boostycard', method: 'sbp', plans: ['m1'], period_days: 30 },
      },
    ],
  } as PlansResponse;
  const [sbp] = activationOptions(plans);
  assert.equal(chooseRoute(sbp, false, SOLO)?.recurring, true);
  assert.equal(usable(sbp, SOLO), true);
  assert.equal(usable(sbp, { ...SOLO, planId: 'm12' }), false);
  assert.equal(chooseRoute(sbp, false, { ...SOLO, planId: 'm12' }), null);
});

test('a bind route names its bind and checks out with that method', () => {
  const chosen = chooseRoute(option('card_ru'), true, SOLO);
  assert.ok(chosen);
  assert.equal(bindOf(chosen.route), 'card');
  assert.equal(bindOf({ provider: 'boostycard', method: 'sbp' }), 'sbp');
  assert.equal(bindOf({ provider: 'platega', method: 'sbp' }), null);
  assert.deepEqual(toCheckout(chosen, 'm1'), {
    plan_id: 'm1',
    provider: 'boostycard',
    method: 'card',
    recurring: true,
  });
});

test('a dollar card is a renew-only bind that needs card support and a personal m1', () => {
  const plans = {
    ...PLANS,
    routes: [
      {
        method: 'card_intl',
        once: null,
        renew: { provider: 'boostycard', method: 'card_usd', plans: ['m1'], period_days: 30 },
      },
    ],
  } as PlansResponse;
  const [intl] = activationOptions(plans);
  const chosen = chooseRoute(intl, false, SOLO);
  assert.ok(chosen);
  assert.equal(chosen.recurring, true);
  assert.equal(bindOf(chosen.route), 'card_usd');
  assert.equal(currencyOf(chosen.route), 'USD');
  assert.deepEqual(toCheckout(chosen, 'm1'), {
    plan_id: 'm1',
    provider: 'boostycard',
    method: 'card_usd',
    recurring: true,
  });
  for (const ctx of [
    { ...SOLO, cardSupported: false },
    { ...SOLO, shared: true },
    { ...SOLO, gift: true },
    { ...SOLO, planId: 'm3' },
  ]) {
    assert.equal(usable(intl, ctx), false, JSON.stringify(ctx));
  }
  assert.equal(currencyOf(option('card_ru').once), 'RUB');
  assert.equal(currencyOf(null), 'RUB');
});
