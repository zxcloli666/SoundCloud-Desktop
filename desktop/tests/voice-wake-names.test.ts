import assert from 'node:assert/strict';
import { test } from 'node:test';
import { wakeNames } from '../src/lib/voice/wake-names.ts';

test('the common name comes first in both languages', () => {
  assert.equal(wakeNames('ru', 'loli')[0], 'Саунд');
  assert.equal(wakeNames('en', 'loli')[0], 'Sound');
});

test('loli answers to her own name', () => {
  assert.deepEqual(wakeNames('ru', 'loli'), ['Саунд', 'Лоля']);
  assert.deepEqual(wakeNames('en', 'loli'), ['Sound', 'Loli']);
});

test('moriarty answers to both of his names', () => {
  assert.deepEqual(wakeNames('ru', 'moriarty'), ['Саунд', 'Мори', 'Мориарти']);
  assert.deepEqual(wakeNames('en', 'moriarty'), ['Sound', 'Mori', 'Moriarty']);
});

test('an unknown voice gets only the common name', () => {
  assert.deepEqual(wakeNames('ru', 'af_heart'), ['Саунд']);
  assert.deepEqual(wakeNames('en', 'am_michael'), ['Sound']);
  assert.deepEqual(wakeNames('en', 'nobody'), ['Sound']);
});

test('nobody is called lolya', () => {
  for (const language of ['ru', 'en']) {
    for (const voice of ['loli', 'moriarty', 'lolya', 'af_heart']) {
      for (const name of wakeNames(language, voice)) assert.doesNotMatch(name, /lolya/i);
    }
  }
});
