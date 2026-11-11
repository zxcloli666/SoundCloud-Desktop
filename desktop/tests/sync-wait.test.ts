import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clockText,
  isWaitKind,
  LONG_WAIT_MS,
  longWaitLeft,
  waitAnchor,
  waitKindOf,
} from '../src/lib/sync-wait.ts';

const NOW = Date.parse('2026-11-11T12:00:00Z');

test('a fresh wait stays calm until the threshold', () => {
  assert.equal(longWaitLeft('syncing', NOW, NOW), LONG_WAIT_MS);
  assert.equal(longWaitLeft('syncing', NOW - 1_500, NOW), LONG_WAIT_MS - 1_500);
  assert.equal(longWaitLeft('syncing', NOW + 60_000, NOW), LONG_WAIT_MS + 60_000);
  assert.equal(longWaitLeft('syncing', NOW - LONG_WAIT_MS, NOW), 0);
  assert.equal(longWaitLeft('syncing', NOW - 14 * 60_000, NOW), 0);
});

test('a stalled queue is long at once', () => {
  assert.equal(longWaitLeft('stalled', NOW, NOW), 0);
});

test('only syncing and stalled queries wait', () => {
  const info = (state: 'complete' | 'syncing' | 'stalled' | 'refused') => ({
    state,
    errorCode: null,
    queuedSince: null,
    waitingSince: NOW,
    retryAt: 0,
  });
  assert.equal(waitKindOf({ isError: false, syncInfo: info('syncing') }), 'syncing');
  assert.equal(waitKindOf({ isError: false, syncInfo: info('stalled') }), 'stalled');
  assert.equal(waitKindOf({ isError: false, syncInfo: info('complete') }), null);
  assert.equal(waitKindOf({ isError: false, syncInfo: info('refused') }), null);
  assert.equal(waitKindOf({ isError: true, syncInfo: info('syncing') }), null);
  assert.equal(isWaitKind('stalled'), true);
  assert.equal(isWaitKind('failed'), false);
  assert.equal(isWaitKind(null), false);
});

test('the clock reads m:ss under an hour and h:mm:ss past it', () => {
  assert.equal(clockText(-1_000), '0:00');
  assert.equal(clockText(0), '0:00');
  assert.equal(clockText(999), '0:00');
  assert.equal(clockText(65_000), '1:05');
  assert.equal(clockText(14 * 60_000 + 3_000), '14:03');
  assert.equal(clockText(3_599_000), '59:59');
  assert.equal(clockText(3_600_000), '1:00:00');
  assert.equal(clockText((3 * 3600 + 5 * 60 + 9) * 1000), '3:05:09');
});

test('queuedSince is the anchor when the server gives it', () => {
  const queued = '2026-11-11T11:46:00Z';
  assert.equal(waitAnchor('a', 'syncing', queued, NOW), Date.parse(queued));
});

test('without queuedSince the first sighting holds until the scope completes', () => {
  assert.equal(waitAnchor('b', 'syncing', null, NOW), NOW);
  assert.equal(waitAnchor('b', 'stalled', null, NOW + 30_000), NOW);
  assert.ok(Number.isNaN(waitAnchor('b', null, null, NOW + 60_000)));
  assert.equal(waitAnchor('b', 'syncing', null, NOW + 90_000), NOW);
  assert.ok(Number.isNaN(waitAnchor('b', 'complete', null, NOW + 120_000)));
  assert.equal(waitAnchor('b', 'syncing', null, NOW + 150_000), NOW + 150_000);
});
