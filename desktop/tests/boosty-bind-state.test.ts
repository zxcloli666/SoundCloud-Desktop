import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindState, linkedBinds } from '../src/lib/boosty-bind-state.ts';
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
