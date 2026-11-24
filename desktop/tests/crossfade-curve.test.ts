import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CROSSFADE_CURVES, incomingGain, outgoingGain } from '../src/lib/crossfade-curve.ts';

const STEPS = Array.from({ length: 21 }, (_, step) => step / 20);

function near(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);
}

test('every curve goes from 0 to 1 without a step back', () => {
  for (const curve of CROSSFADE_CURVES) {
    near(incomingGain(curve, 0), 0);
    near(incomingGain(curve, 1), 1);
    near(outgoingGain(curve, 0), 1);
    near(outgoingGain(curve, 1), 0);
    for (let i = 1; i < STEPS.length; i++) {
      assert.ok(incomingGain(curve, STEPS[i]) > incomingGain(curve, STEPS[i - 1]));
      assert.ok(outgoingGain(curve, STEPS[i]) < outgoingGain(curve, STEPS[i - 1]));
    }
  }
});

test('equal power keeps the power, linear and smooth keep the amplitude', () => {
  for (const step of STEPS) {
    near(incomingGain('equal_power', step) ** 2 + outgoingGain('equal_power', step) ** 2, 1);
    near(incomingGain('linear', step) + outgoingGain('linear', step), 1);
    near(incomingGain('smooth', step) + outgoingGain('smooth', step), 1);
  }
});

test('progress outside the fade is clamped', () => {
  for (const curve of CROSSFADE_CURVES) {
    near(incomingGain(curve, -1), 0);
    near(incomingGain(curve, 2), 1);
  }
});
