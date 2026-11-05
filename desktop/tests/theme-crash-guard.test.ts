import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crashedTheme, parseSentinel, sentinelText } from '../src/lib/themes/crash-guard.ts';

const ID = 'bonbon';
const HASH = '9f2c41';
const PAGE = 'a1b2c3d4e5f6';

function themeOffOnNextStart(file: string): boolean {
  return crashedTheme(parseSentinel(file), ID, HASH);
}

test('a reload in the first 8 s keeps the theme on', () => {
  assert.equal(themeOffOnNextStart(`${sentinelText(ID, HASH, PAGE)} reload`), false);
});

test('a crash in the first 8 s turns the theme off', () => {
  assert.equal(themeOffOnNextStart(sentinelText(ID, HASH, PAGE)), true);
});

test('a start after a settled theme finds no sentinel', () => {
  assert.equal(themeOffOnNextStart(''), false);
});

test('a crash under another theme or version does not blame this one', () => {
  assert.equal(themeOffOnNextStart(sentinelText('other', HASH, PAGE)), false);
  assert.equal(themeOffOnNextStart(sentinelText(ID, 'old', PAGE)), false);
});

test('a sentinel written by an older build still counts', () => {
  assert.equal(themeOffOnNextStart(`${ID} ${HASH}`), true);
  assert.equal(themeOffOnNextStart(`${ID} ${HASH} reload`), false);
});

test('a broken sentinel blames nobody', () => {
  assert.equal(parseSentinel('broken'), null);
  assert.equal(themeOffOnNextStart('  '), false);
});

test('the file reads back the theme, version and mark', () => {
  assert.deepEqual(parseSentinel(`${sentinelText(ID, HASH, PAGE)} reload\n`), {
    id: ID,
    hash: HASH,
    reload: true,
  });
});
