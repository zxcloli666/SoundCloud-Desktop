import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clampLyricsOffset,
  formatLyricsOffset,
  LYRICS_OFFSET_KEEP,
  LYRICS_OFFSET_MAX,
  shiftLyricLines,
  stepLyricsOffset,
  withLyricsOffset,
} from '../src/lib/lyrics-offset.ts';

const lines = [
  { time: 0.2, text: 'a' },
  { time: 10, text: 'b' },
];

test('step moves by half a second and stops at the limit', () => {
  assert.equal(stepLyricsOffset(0, 1), 0.5);
  assert.equal(stepLyricsOffset(0.5, -1), 0);
  assert.equal(stepLyricsOffset(LYRICS_OFFSET_MAX, 1), LYRICS_OFFSET_MAX);
  assert.equal(clampLyricsOffset(0.1 + 0.2), 0.3);
});

test('shift moves every line and never goes below zero', () => {
  assert.deepEqual(shiftLyricLines(lines, 1.5), [
    { time: 1.7, text: 'a' },
    { time: 11.5, text: 'b' },
  ]);
  assert.deepEqual(shiftLyricLines(lines, -1), [
    { time: 0, text: 'a' },
    { time: 9, text: 'b' },
  ]);
  assert.equal(shiftLyricLines(lines, 0), lines);
});

test('format shows the sign', () => {
  assert.equal(formatLyricsOffset(1), '+1.0 s');
  assert.equal(formatLyricsOffset(-0.5), '-0.5 s');
  assert.equal(formatLyricsOffset(0), '0.0 s');
});

test('stored offsets are per track, zero removes the entry, old ones fall off', () => {
  let offsets = withLyricsOffset({}, 'soundcloud:tracks:1', 1);
  offsets = withLyricsOffset(offsets, 'soundcloud:tracks:2', -0.5);
  assert.deepEqual(offsets, { 'soundcloud:tracks:1': 1, 'soundcloud:tracks:2': -0.5 });
  assert.deepEqual(withLyricsOffset(offsets, 'soundcloud:tracks:1', 0), {
    'soundcloud:tracks:2': -0.5,
  });
  let many: Record<string, number> = {};
  for (let i = 0; i < LYRICS_OFFSET_KEEP + 5; i++) many = withLyricsOffset(many, `t${i}`, 1);
  assert.equal(Object.keys(many).length, LYRICS_OFFSET_KEEP);
  assert.equal('t0' in many, false);
});
