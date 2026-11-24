import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startRefusal } from '../src/lib/card-link/reasons.ts';

test('a personal limit is not a busy slot', () => {
  assert.equal(startRefusal(429, 'too_many_attempts'), 'limit');
  assert.equal(startRefusal(429, 'slot_busy'), 'busy');
  assert.equal(startRefusal(429, null), 'busy');
});

test('other start refusals', () => {
  assert.equal(startRefusal(503, null), 'unavailable');
  assert.equal(startRefusal(501, null), 'unavailable');
  assert.equal(startRefusal(502, null), 'network');
});
