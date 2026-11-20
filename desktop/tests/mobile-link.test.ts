import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  acceptsCallback,
  isFinal,
  LINK_TTL_MS,
  minutesLeft,
  type Phase,
  phaseOfStatus,
  pollDelay,
  reachedStep,
  wasSeen,
} from '../src/lib/mobile-link/flow.ts';

test('server statuses map to phases', () => {
  assert.equal(phaseOfStatus('waiting', 'pending'), 'waiting');
  assert.equal(phaseOfStatus('waiting', 'processing'), 'received');
  assert.equal(phaseOfStatus('received', 'completed'), 'completed');
  assert.equal(phaseOfStatus('received', 'account_mismatch'), 'mismatch');
  assert.equal(phaseOfStatus('received', 'failed'), 'failed');
  assert.equal(phaseOfStatus('waiting', 'expired'), 'expired');
});

test('a final phase never moves on a late status', () => {
  const finals: Phase[] = ['completed', 'mismatch', 'failed', 'expired'];
  for (const phase of finals) {
    assert.ok(isFinal(phase));
    assert.equal(phaseOfStatus(phase, 'pending'), phase);
    assert.equal(phaseOfStatus(phase, 'completed'), phase);
  }
  assert.ok(!isFinal('waiting'));
  assert.ok(!isFinal('received'));
});

test('the same state is handled once', () => {
  const seen = new Set<string>();
  assert.equal(wasSeen(seen, 'a'), false);
  assert.equal(wasSeen(seen, 'a'), true);
  assert.equal(wasSeen(seen, 'b'), false);
  assert.equal(wasSeen(seen, 'b'), true);
});

test('a code is taken only while waiting for the browser', () => {
  assert.ok(acceptsCallback('waiting'));
  for (const phase of [
    'starting',
    'received',
    'completed',
    'mismatch',
    'failed',
    'expired',
  ] as const) {
    assert.ok(!acceptsCallback(phase), phase);
  }
});

test('minutes left count down to zero and never go negative', () => {
  const at = 1_000_000;
  assert.equal(minutesLeft(at, at), 15);
  assert.equal(minutesLeft(at, at + 60_000), 14);
  assert.equal(minutesLeft(at, at + 14 * 60_000 + 1), 1);
  assert.equal(minutesLeft(at, at + LINK_TTL_MS), 0);
  assert.equal(minutesLeft(at, at + LINK_TTL_MS * 2), 0);
});

test('the step marker only moves forward', () => {
  let step = 0;
  step = reachedStep(step, 'waiting');
  assert.equal(step, 0);
  step = reachedStep(step, 'received');
  assert.equal(step, 1);
  step = reachedStep(step, 'failed');
  assert.equal(step, 1);
  step = reachedStep(step, 'completed');
  assert.equal(step, 2);
});

test('polling speeds up once the code is sent', () => {
  assert.ok(pollDelay('received') < pollDelay('waiting'));
});
