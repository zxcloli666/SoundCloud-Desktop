import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canSaveOwnLyrics,
  checkOwnLyrics,
  formatTrackLength,
  lyricsPreview,
  OWN_LYRICS_MAX_BYTES,
  ownLyricsInput,
} from '../src/lib/own-lyrics-text.ts';

test('text without times is plain lyrics', () => {
  const check = checkOwnLyrics('first line\r\nsecond line\n\n');
  assert.equal(check.kind, 'plain');
  assert.equal(check.lines, 2);
  assert.ok(canSaveOwnLyrics(check));
  assert.deepEqual(ownLyricsInput(' first\r\nsecond ', check), { plainText: 'first\nsecond' });
});

test('timed lines with tags and stacked stamps are synced lyrics', () => {
  const lrc = '[ar:Someone]\n[ti:Song]\n[00:01.50]hello\n[00:03.00][01:10:5]again\n[00:05]';
  const check = checkOwnLyrics(lrc);
  assert.equal(check.kind, 'synced');
  assert.equal(check.badLine, null);
  assert.equal(check.lines, 3);
  assert.ok(canSaveOwnLyrics(check));
  assert.deepEqual(ownLyricsInput(lrc, check), { syncedLrc: lrc });
});

test('an untimed line in LRC is named by its line in the box', () => {
  const check = checkOwnLyrics('\n\n[00:01.00]one\nloose words\n[00:03.00]three');
  assert.equal(check.kind, 'synced');
  assert.equal(check.badLine, 4);
  assert.equal(canSaveOwnLyrics(check), false);
});

test('impossible stamps are not times', () => {
  assert.equal(checkOwnLyrics('[00:01.00]ok\n[00:61.00]late').badLine, 2);
  assert.equal(checkOwnLyrics('[00:01.00]ok\n[00:01.0000]long').badLine, 2);
});

test('LRC where no timed line has words cannot be saved', () => {
  const check = checkOwnLyrics('[00:01.00]\n[00:02.00]  ');
  assert.equal(check.silent, true);
  assert.equal(canSaveOwnLyrics(check), false);
});

test('empty and oversized text cannot be saved', () => {
  assert.equal(checkOwnLyrics('  \n ').kind, 'empty');
  assert.equal(canSaveOwnLyrics(checkOwnLyrics('')), false);
  const huge = checkOwnLyrics('я'.repeat(OWN_LYRICS_MAX_BYTES / 2 + 1));
  assert.equal(huge.tooLong, true);
  assert.equal(canSaveOwnLyrics(huge), false);
});

test('preview drops times and blank lines', () => {
  assert.deepEqual(lyricsPreview('[00:01.00]one\n[00:02.00]\n[00:03.00]two', null, 4), [
    'one',
    'two',
  ]);
  assert.deepEqual(lyricsPreview(null, 'a\n\nb\nc', 2), ['a', 'b']);
});

test('track length reads as minutes and seconds', () => {
  assert.equal(formatTrackLength(221.4), '3:41');
  assert.equal(formatTrackLength(null), '');
  assert.equal(formatTrackLength(0), '');
});
