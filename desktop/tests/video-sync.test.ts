import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clockTime,
  LEAD_MIN_SEC,
  leadFor,
  parkStep,
  syncStep,
  videoTarget,
} from '../src/lib/video-sync.ts';

test('the clock runs on from the last tick at the player rate', () => {
  const clock = { pos: 10, at: 1_000, rate: 1, playing: true };
  assert.equal(clockTime(clock, 1_500), 10.5);
  assert.equal(clockTime({ ...clock, rate: 2 }, 1_500), 11);
  assert.equal(clockTime({ ...clock, rate: 0.5 }, 1_500), 10.25);
});

test('a paused clock stands still', () => {
  assert.equal(clockTime({ pos: 10, at: 1_000, rate: 1, playing: false }, 9_000), 10);
});

test('the video time is the track time plus the offset', () => {
  assert.equal(videoTarget(10, 2_500), 12.5);
  assert.equal(videoTarget(10, 0), 10);
  assert.equal(videoTarget(1, -3_000), -2);
});

test('before the clip starts the video waits on its first frame', () => {
  assert.deepEqual(syncStep(-2, 0, 120, 1), { kind: 'wait' });
});

test('past the end of the clip it holds the last frame', () => {
  assert.deepEqual(syncStep(120, 119.9, 120, 1), { kind: 'end' });
  assert.deepEqual(syncStep(200, 119.9, 120, 1), { kind: 'end' });
});

test('small drift is left alone', () => {
  assert.deepEqual(syncStep(10, 10.1, 120, 1), { kind: 'hold', rate: 1 });
  assert.deepEqual(syncStep(10, 9.86, 120, 1), { kind: 'hold', rate: 1 });
});

test('medium drift is nudged by five percent towards the audio', () => {
  assert.deepEqual(syncStep(10, 10.3, 120, 1), { kind: 'nudge', rate: 0.95 });
  assert.deepEqual(syncStep(10, 9.7, 120, 1), { kind: 'nudge', rate: 1.05 });
});

test('once nudging it keeps going until the drift is nearly gone', () => {
  assert.deepEqual(syncStep(10, 10.1, 120, 1, true), { kind: 'nudge', rate: 0.95 });
  assert.deepEqual(syncStep(10, 10.03, 120, 1, true), { kind: 'hold', rate: 1 });
});

test('large drift jumps to the audio', () => {
  assert.deepEqual(syncStep(10, 12, 120, 1), { kind: 'jump', time: 10, rate: 1 });
  assert.deepEqual(syncStep(10, 2, 120, 1), { kind: 'jump', time: 10, rate: 1 });
});

test('the player speed carries into the video rate', () => {
  assert.deepEqual(syncStep(10, 10, 120, 2), { kind: 'hold', rate: 2 });
  assert.deepEqual(syncStep(10, 10.3, 120, 0.5), { kind: 'nudge', rate: 0.475 });
  assert.deepEqual(syncStep(10, 9.7, 120, 2), { kind: 'nudge', rate: 2.1 });
});

test('an unknown duration never ends the clip', () => {
  assert.deepEqual(syncStep(500, 500, Number.NaN, 1), { kind: 'hold', rate: 1 });
});

test('a parked video waits for its moment and starts on it', () => {
  assert.equal(parkStep(10, 12, true), 'wait');
  assert.equal(parkStep(11.99, 12, true), 'play');
  assert.equal(parkStep(12.3, 12, true), 'play');
});

test('a parked video that is late parks again only when it can go on or the wait is too long', () => {
  assert.equal(parkStep(13, 12, false), 'wait');
  assert.equal(parkStep(13, 12, true), 'again');
  assert.equal(parkStep(16.5, 12, false), 'again');
});

test('the lead follows the wait and stays in bounds', () => {
  assert.equal(leadFor(0), LEAD_MIN_SEC);
  assert.equal(leadFor(2), 1.6);
  assert.equal(leadFor(60), 4);
});
