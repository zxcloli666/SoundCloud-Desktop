import assert from 'node:assert/strict';
import { test } from 'node:test';
import { earVolume, volumesByEar } from '../src/lib/legacy/volume.ts';
import { volumeGain } from '../src/lib/volume.ts';

const everyPercent = Array.from({ length: 201 }, (_, percent) => percent);
const decibels = (gain: number) => 20 * Math.log10(gain);

test('the curve is quadratic below 100% and untouched from there on', () => {
  assert.equal(volumeGain(0), 0);
  assert.equal(volumeGain(10), 0.1 ** 2);
  assert.equal(volumeGain(50), 0.25);
  assert.equal(volumeGain(100), 1);
  assert.equal(volumeGain(150), 1.5);
  assert.equal(volumeGain(200), 2);
  assert.equal(volumeGain(300), 2);
});

test('the curve never goes down', () => {
  for (const percent of everyPercent.slice(1)) {
    assert.ok(volumeGain(percent) > volumeGain(percent - 1), `${percent}`);
  }
});

test('an old volume keeps its loudness', () => {
  for (const percent of everyPercent.slice(1)) {
    const drift = decibels(volumeGain(earVolume(percent))) - decibels(percent / 100);
    assert.ok(Math.abs(drift) < 0.4, `${percent}% drifts by ${drift} dB`);
  }
  assert.equal(earVolume(0), 0);
  assert.equal(earVolume(25), 50);
  assert.equal(earVolume(49), 70);
  assert.equal(earVolume(100), 100);
  assert.equal(earVolume(140), 140);
});

test('a file of the previous version keeps its loudness and everything else', () => {
  assert.deepEqual(volumesByEar({ volume: 36, volumeBeforeMute: 81, shuffle: true }), {
    volume: 60,
    volumeBeforeMute: 90,
    shuffle: true,
  });
});

test('an empty file leaves the defaults alone', () => {
  assert.deepEqual(volumesByEar({}), {});
});
