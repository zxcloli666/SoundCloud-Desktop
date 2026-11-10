import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import {
  photoState,
  photoWaitUntil,
  uploadStatus,
} from '../src/components/chat/backdrop/photo-state.ts';
import { backdropFace, RETRY_MS, retriesAfter } from '../src/components/chat/backdrop/retry.ts';
import { chatNavShown, gateOf } from '../src/lib/chat/gate.ts';
import { accountChange, holdsLocalStore, uploadActionsRun } from '../src/stores/chat/account.ts';
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

test('only a sign-out or a switch resets the media store, a cold start does not', () => {
  assert.equal(accountChange(null, { userId: '100' }), 'none');
  assert.equal(accountChange({ userId: null }, { userId: '100' }), 'arrived');
  assert.equal(accountChange({ userId: '100' }, { userId: '100' }), 'none');
  assert.equal(accountChange({ userId: '100' }, { userId: null }), 'switched');
  assert.equal(accountChange({ userId: '100' }, { userId: '200' }), 'switched');
});

test('the keychain card shows on a cold start with no chat config', () => {
  assert.equal(gateOf(false, 'keychain_denied'), 'keychain');
  assert.equal(gateOf(false, 'keychain_unavailable'), 'keychain');
  assert.equal(gateOf(true, 'keychain_unavailable'), 'keychain');
  assert.equal(gateOf(false, 'unbound'), 'relogin');
  assert.equal(gateOf(false, 'revoked'), 'revoked');
  assert.equal(gateOf(false, 'signed_out'), 'off');
  assert.equal(gateOf(false, null), 'off');
  assert.equal(gateOf(true, 'starting'), 'loading');
  assert.equal(gateOf(true, 'ready'), 'open');
});

test('uploads stay visible while a local store exists and act only when it answers', () => {
  for (const phase of ['starting', 'ready', 'off'] as const) {
    assert.equal(holdsLocalStore(phase), true, phase);
    assert.equal(uploadActionsRun(phase, true), true, phase);
    assert.equal(uploadActionsRun(phase, false), false, phase);
  }
  for (const phase of [
    'signed_out',
    'unbound',
    'bound_other',
    'revoked',
    'keychain_denied',
    'keychain_unavailable',
  ] as const) {
    assert.equal(holdsLocalStore(phase), false, phase);
    assert.equal(uploadActionsRun(phase, true), false, phase);
  }
  assert.equal(holdsLocalStore(null), false);
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

test('a photo the server refused for a cooldown shows the countdown, then Retry', () => {
  const now = 1_800_000_000_000;
  const refused = {
    code: 'backdrop_cooldown',
    key: 'k',
    fix: 'wait',
    until: now + 60_000,
    timeInText: true,
  } as const;
  const failed = uploadStatus(null, { code: 'backdrop_cooldown', until: now + 60_000 });
  const until = photoWaitUntil(null, refused);
  assert.equal(until, now + 60_000);
  assert.deepEqual(photoState(failed, null, (until ?? now) - now), {
    kind: 'cooldown',
    leftMs: 60_000,
  });
  assert.deepEqual(photoState(failed, null, 0), { kind: 'failed' });
  assert.equal(photoWaitUntil(now + 5, { ...refused, fix: 'retry' }), now + 5);
  assert.equal(photoWaitUntil(now + 90_000, refused), now + 90_000);
  assert.equal(photoWaitUntil(undefined, null), null);
});

test('chats stay in the sidebar while a parked keychain or relogin waits, even with no config', () => {
  assert.equal(chatNavShown(false, false, 'keychain_denied'), true);
  assert.equal(chatNavShown(false, false, 'keychain_unavailable'), true);
  assert.equal(chatNavShown(false, false, 'unbound'), true);
  assert.equal(chatNavShown(false, false, 'starting'), false);
  assert.equal(chatNavShown(false, false, null), false);
  assert.equal(chatNavShown(false, true, 'keychain_denied'), false);
  assert.equal(chatNavShown(true, true, 'ready'), true);
});
