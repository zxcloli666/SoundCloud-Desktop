import assert from 'node:assert/strict';
import { test } from 'node:test';
import { numberedFileNames } from '../src/lib/filename.ts';

test('files are numbered in list order', () => {
  assert.deepEqual(numberedFileNames(['Luma - Night', 'Okto - Glass'], 'm4a'), [
    '01 - Luma - Night.m4a',
    '02 - Okto - Glass.m4a',
  ]);
});

test('the number is as wide as the list needs', () => {
  const names = numberedFileNames(Array.from({ length: 120 }, (_, i) => `A - ${i}`), 'mp3');
  assert.equal(names[0], '001 - A - 0.mp3');
  assert.equal(names[119], '120 - A - 119.mp3');
});

test('the same name twice stays apart without the number', () => {
  assert.deepEqual(numberedFileNames(['A - a', 'a - A'], 'm4a'), [
    '01 - A - a.m4a',
    '02 - a - A (2).m4a',
  ]);
});
