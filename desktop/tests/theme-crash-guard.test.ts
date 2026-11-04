import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  crashedTheme,
  parseSentinel,
  reloadText,
  sentinelText,
} from '../src/lib/themes/crash-guard.ts';

const ID = 'bonbon';
const HASH = '9f2c41';

function themeOffOnNextStart(file: string): boolean {
  return crashedTheme(parseSentinel(file), ID, HASH);
}

test('a reload in the first 8 s keeps the theme on', () => {
  const applying = sentinelText(ID, HASH);
  const reloaded = reloadText(applying);
  assert.ok(reloaded);
  assert.equal(themeOffOnNextStart(reloaded), false);
});

test('a crash in the first 8 s turns the theme off', () => {
  assert.equal(themeOffOnNextStart(sentinelText(ID, HASH)), true);
});

test('a start after a settled theme finds no sentinel', () => {
  assert.equal(themeOffOnNextStart(''), false);
});

test('a crash under another theme or version does not blame this one', () => {
  assert.equal(themeOffOnNextStart(sentinelText('other', HASH)), false);
  assert.equal(themeOffOnNextStart(sentinelText(ID, 'old')), false);
});

test('a reload with no theme applying marks nothing', () => {
  assert.equal(reloadText(''), null);
  assert.equal(reloadText('broken'), null);
});

test('a reload mark survives a second read', () => {
  const reloaded = reloadText(sentinelText(ID, HASH)) ?? '';
  assert.deepEqual(parseSentinel(reloaded), { id: ID, hash: HASH, reload: true });
  assert.equal(reloadText(reloaded), reloaded);
});
