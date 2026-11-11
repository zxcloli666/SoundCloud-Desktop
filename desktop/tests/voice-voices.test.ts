import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DEFAULT_VOICE, knownVoice, VOICE_IDS } from '../src/lib/voice/voice-ids.ts';

const LANGUAGES = ['en', 'ru', 'tr', 'ko', 'pt'];

function names(lang: string): Record<string, { name?: string }> {
  const url = new URL(`../src/i18n/locales/voice/${lang}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')).voice.voices;
}

test('a saved voice id that no longer exists falls back to the default voice', () => {
  assert.equal(DEFAULT_VOICE, 'loli');
  assert.equal(knownVoice('lolya'), 'loli');
  assert.equal(knownVoice('robot'), 'loli');
  assert.equal(knownVoice(undefined), 'loli');
  assert.equal(knownVoice(7), 'loli');
  for (const id of VOICE_IDS) assert.equal(knownVoice(id), id);
});

test('every voice has a name in all five languages and no stale ids are left', () => {
  for (const lang of LANGUAGES) {
    const voices = names(lang);
    assert.deepEqual(Object.keys(voices).sort(), [...VOICE_IDS].sort(), lang);
    for (const id of VOICE_IDS) assert.ok(voices[id].name, `${lang}: ${id}`);
  }
});
