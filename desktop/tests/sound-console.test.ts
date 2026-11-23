import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bandAt,
  bandX,
  clampGain,
  curvePath,
  curvePoints,
  gainAt,
  gainY,
} from '../src/lib/sound/eq-curve.ts';
import {
  formatPitch,
  formatRate,
  type SoundSnapshot,
  soundTokens,
  speaksForItself,
} from '../src/lib/sound/live.ts';

const QUIET: SoundSnapshot = {
  fx: null,
  fxRate: 1,
  eq: false,
  rate: 1,
  pitch: null,
  sleep: false,
  loop: false,
};

const ids = (patch: Partial<SoundSnapshot>) =>
  soundTokens({ ...QUIET, ...patch }).map((token) => token.id);

test('a resting player has no tokens', () => {
  assert.deepEqual(ids({}), []);
  assert.deepEqual(ids({ pitch: 0 }), []);
});

test('the rate of an effect is part of the effect until it is changed by hand', () => {
  assert.deepEqual(ids({ fx: 'slowedReverb', fxRate: 0.85, rate: 0.85 }), ['fx']);
  assert.deepEqual(ids({ fx: 'slowedReverb', fxRate: 0.85, rate: 0.9 }), ['fx', 'rate']);
  assert.deepEqual(ids({ rate: 0.85 }), ['rate']);
});

test('tokens with words come before bare icons', () => {
  assert.deepEqual(ids({ fx: 'bass', eq: true, rate: 1.25, pitch: -2, sleep: true, loop: true }), [
    'fx',
    'sleep',
    'rate',
    'pitch',
    'loop',
    'eq',
  ]);
  assert.equal(speaksForItself(soundTokens({ ...QUIET, eq: true, loop: true })), false);
  assert.equal(speaksForItself(soundTokens({ ...QUIET, eq: true, sleep: true })), true);
});

test('rate and pitch read without trailing zeros', () => {
  assert.equal(formatRate(1), '1x');
  assert.equal(formatRate(0.85), '0.85x');
  assert.equal(formatRate(1.5), '1.5x');
  assert.equal(formatPitch(0), '0');
  assert.equal(formatPitch(2), '+2');
  assert.equal(formatPitch(-2.8), '-2.8');
});

test('a pointer maps to the nearest band and a half-decibel step', () => {
  assert.equal(bandAt(-0.2), 0);
  assert.equal(bandAt(bandX(4)), 4);
  assert.equal(bandAt(1.4), 9);
  assert.equal(gainAt(0), 12);
  assert.equal(gainAt(0.5), 0);
  assert.equal(gainAt(1), -12);
  assert.equal(gainAt(gainY(3.5)), 3.5);
  assert.equal(clampGain(40), 12);
  assert.equal(clampGain(1.3), 1.5);
});

test('a flat equalizer draws a straight line across the middle', () => {
  const points = curvePoints(Array(10).fill(0), 400, 100);
  assert.equal(points.length, 12);
  assert.ok(points.every((p) => p.y === 50));
  const ys = curvePath(points)
    .split(/[MC ]/)
    .filter(Boolean)
    .map(Number)
    .filter((_, i) => i % 2 === 1);
  assert.ok(ys.every((y) => y === 50));
});

test('the curve never swings past its points', () => {
  const gains = [12, 12, -12, -12, 0, 12, -12, 12, 0, 0];
  const path = curvePath(curvePoints(gains, 400, 100));
  const ys = path
    .split(/[MC ]/)
    .filter(Boolean)
    .map(Number)
    .filter((_, i) => i % 2 === 1);
  assert.ok(ys.every((y) => y >= 0 && y <= 100));
});
