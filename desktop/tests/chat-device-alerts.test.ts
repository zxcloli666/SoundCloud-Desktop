import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AGE_RULE_MS,
  type DeviceAlerts,
  dismissed,
  pushed,
  restored,
  snoozed,
  woken,
} from '../src/lib/chat/device-alerts.ts';
import type { Device } from '../src/lib/chat/types.ts';

const HOUR = 3_600_000;
const BORN = Date.parse('2026-11-23T09:44:00Z');
const EMPTY: DeviceAlerts = { alerts: [], snoozed: [], quiet: {} };

const device = (id: string) =>
  ({ id, status: 'active', historyUnlocked: false, createdAt: BORN }) as Device;

const restart = (state: DeviceAlerts, now: number) => restored(EMPTY, state.quiet, now);

const ids = (state: DeviceAlerts) => state.alerts.map((alert) => alert.id);

test('a new device asks at once', () => {
  assert.deepEqual(ids(pushed(EMPTY, device('a'), BORN + HOUR)), ['a']);
});

test('an answered device stays quiet after a restart', () => {
  const answered = dismissed(pushed(EMPTY, device('a'), BORN + HOUR), 'a');
  const next = pushed(restart(answered, BORN + 2 * HOUR), device('a'), BORN + 2 * HOUR);
  assert.deepEqual(ids(next), []);
  assert.deepEqual(next.snoozed, []);
});

test('a closed alert comes back with the next reminder, not with the next start', () => {
  const closed = snoozed(pushed(EMPTY, device('a'), BORN + HOUR), 'a', BORN + HOUR);
  const next = pushed(restart(closed, BORN + 2 * HOUR), device('a'), BORN + 2 * HOUR);
  assert.deepEqual(ids(next), []);
  assert.deepEqual(ids(woken(next, BORN + 23 * HOUR)), []);
  assert.deepEqual(ids(woken(next, BORN + 24 * HOUR)), ['a']);
  const late = pushed(restart(closed, BORN + 25 * HOUR), device('a'), BORN + 25 * HOUR);
  assert.deepEqual(ids(late), ['a']);
});

test('closing the last reminder leaves nothing to remind of', () => {
  const now = BORN + 50 * HOUR;
  const closed = snoozed(pushed(EMPTY, device('a'), now), 'a', now);
  assert.deepEqual(closed.snoozed, []);
  assert.equal(closed.quiet.a, BORN + AGE_RULE_MS);
});

test('one answered device does not hush another', () => {
  const answered = dismissed(pushed(EMPTY, device('a'), BORN + HOUR), 'a');
  assert.deepEqual(ids(pushed(answered, device('b'), BORN + HOUR)), ['b']);
});

test('an alert shown before the saved answers arrive is taken back', () => {
  const early = pushed(EMPTY, device('a'), BORN + HOUR);
  const state = restored(early, { a: BORN + AGE_RULE_MS }, BORN + HOUR);
  assert.deepEqual(ids(state), []);
});

test('expired answers are forgotten', () => {
  assert.deepEqual(restored(EMPTY, { a: BORN }, BORN + HOUR).quiet, {});
});
