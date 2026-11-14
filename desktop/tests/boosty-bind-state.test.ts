import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindState, linkedBinds, renewalRelink } from '../src/lib/boosty-bind-state.ts';
import type { BoostyBinds } from '../src/lib/pay-client.ts';

const BINDS = { card: true, sbp: true, card_usd: false };

test('an older pay without rebind keeps every link as linked', () => {
  const old: BoostyBinds = { bound: true, binds: BINDS };
  assert.equal(bindState(old, 'card'), 'linked');
  assert.equal(bindState(old, 'card_usd'), 'none');
  assert.deepEqual(linkedBinds(old), [
    { method: 'card', rebind: false },
    { method: 'sbp', rebind: false },
  ]);
});

test('a link on a retiring account asks to be linked again', () => {
  const now: BoostyBinds = {
    bound: true,
    binds: BINDS,
    rebind: { card: false, sbp: true, card_usd: false },
  };
  assert.equal(bindState(now, 'sbp'), 'rebind');
  assert.equal(bindState(now, 'card'), 'linked');
  assert.deepEqual(linkedBinds(now), [
    { method: 'card', rebind: false },
    { method: 'sbp', rebind: true },
  ]);
});

test('rebind without a link is no link at all', () => {
  const gone: BoostyBinds = {
    bound: false,
    binds: { card: false, sbp: false, card_usd: false },
    rebind: { card: true, sbp: true, card_usd: true },
  };
  assert.equal(bindState(gone, 'card'), 'none');
  assert.deepEqual(linkedBinds(gone), []);
  assert.equal(bindState(undefined, 'card'), 'none');
});

const RENEWAL = {
  source: 'boosty_card',
  at: 1_800_000_000,
  amount: 14900,
  currency: 'RUB',
  period_days: 30,
};
const RETIRING: BoostyBinds = {
  bound: true,
  binds: { card: true, sbp: true, card_usd: true },
  rebind: { card: true, sbp: false, card_usd: true },
};

test('a renewal on a retiring link waits for linking again', () => {
  assert.equal(renewalRelink({ ...RENEWAL, method: 'card' }, RETIRING), 'card');
  assert.equal(renewalRelink({ ...RENEWAL, method: null }, RETIRING), 'card');
  assert.equal(renewalRelink({ ...RENEWAL, method: 'sbp' }, RETIRING), null);
  assert.equal(renewalRelink({ ...RENEWAL, currency: 'USD', amount: 499 }, RETIRING), 'card_usd');
});

test('without the renewal method a ruble renewal waits only when every ruble link retires', () => {
  assert.equal(renewalRelink(RENEWAL, RETIRING), null);
  const cardOnly: BoostyBinds = { ...RETIRING, binds: { card: true, sbp: false, card_usd: false } };
  assert.equal(renewalRelink(RENEWAL, cardOnly), 'card');
  const both: BoostyBinds = { ...RETIRING, rebind: { card: true, sbp: true, card_usd: false } };
  assert.equal(renewalRelink(RENEWAL, both), 'card');
});

test('other renewals and an older pay never wait', () => {
  assert.equal(renewalRelink({ ...RENEWAL, source: 'tgstars' }, RETIRING), null);
  assert.equal(renewalRelink(RENEWAL, { bound: true, binds: BINDS }), null);
  assert.equal(renewalRelink(RENEWAL, undefined), null);
});
