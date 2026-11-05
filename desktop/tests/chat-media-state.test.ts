import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import {
  backdropFace,
  RETRY_MS,
  retriesAfter,
} from '../src/components/chat/room/backdrop/retry.ts';
import { accountMoved } from '../src/stores/chat/account.ts';
import { forgetTimers } from '../src/stores/chat/forget-timers.ts';

test('a lost image is forgotten when the Rust side forgets it', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const forgotten: string[] = [];
    const timers = forgetTimers<string>((id) => forgotten.push(id));
    timers.schedule('a', 600_000);
    timers.schedule('b', null);
    mock.timers.tick(599_999);
    assert.deepEqual(forgotten, []);
    mock.timers.tick(1);
    assert.deepEqual(forgotten, ['a']);
    mock.timers.tick(10_000_000);
    assert.deepEqual(forgotten, ['a']);
  } finally {
    mock.timers.reset();
  }
});

test('a new notice, a retry or a reset replaces the pending forget', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const forgotten: string[] = [];
    const timers = forgetTimers<string>((id) => forgotten.push(id));
    timers.schedule('a', 1_000);
    timers.schedule('a', 5_000);
    mock.timers.tick(1_000);
    assert.deepEqual(forgotten, []);
    timers.cancel('a');
    timers.schedule('b', 1_000);
    timers.clear();
    mock.timers.tick(10_000);
    assert.deepEqual(forgotten, []);
  } finally {
    mock.timers.reset();
  }
});

test('the media store resets when the chat account changes or signs out', () => {
  assert.equal(accountMoved(null, { userId: '100' }), false);
  assert.equal(accountMoved({ userId: '100' }, { userId: '100' }), false);
  assert.equal(accountMoved({ userId: '100' }, { userId: null }), true);
  assert.equal(accountMoved({ userId: null }, { userId: '200' }), true);
  assert.equal(accountMoved({ userId: '100' }, { userId: '200' }), true);
});

test('a deleted backdrop shows the cover and never asks again', () => {
  assert.equal(backdropFace('deleted', false), 'cover');
  assert.equal(backdropFace('deleted', true), 'cover');
  assert.equal(retriesAfter('cover'), null);
  assert.equal(backdropFace(undefined, true), 'waiting');
  assert.equal(backdropFace('lost', true), 'waiting');
  assert.equal(retriesAfter('waiting'), RETRY_MS);
  assert.equal(backdropFace(undefined, false), 'image');
  assert.equal(retriesAfter('image'), null);
});
