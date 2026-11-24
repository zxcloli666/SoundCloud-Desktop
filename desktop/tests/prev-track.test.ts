import assert from 'node:assert/strict';
import { test } from 'node:test';
import { restartsOnPrev } from '../src/lib/prev-track.ts';

test('a track in its first seconds gives way to the previous one', () => {
  assert.equal(restartsOnPrev(0, 0), false);
  assert.equal(restartsOnPrev(3, 0), false);
  assert.equal(restartsOnPrev(3.1, 0), true);
});

test('skipped silence does not count as played', () => {
  assert.equal(restartsOnPrev(7.5, 7.5), false);
  assert.equal(restartsOnPrev(9, 7.5), false);
  assert.equal(restartsOnPrev(11, 7.5), true);
});

test('a restart on its way over the silence still leads back', () => {
  assert.equal(restartsOnPrev(0, 7.5), false);
});
