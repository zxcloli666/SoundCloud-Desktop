import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { engineConfig, type VoiceLocale } from '../src/lib/voice/names.ts';
import type { VoiceConfig } from '../src/lib/voice/types';
import { VOICE_IDS } from '../src/lib/voice/voice-ids.ts';

const LANGUAGES = ['en', 'ru', 'tr', 'ko', 'pt'];
const LOCALES = LANGUAGES.map(locale);

function locale(lang: string): VoiceLocale {
  const url = new URL(`../src/i18n/locales/voice/${lang}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

function config(voice: string): VoiceConfig {
  return {
    enabled: true,
    language: 'ru',
    activation: {
      hotkey: null,
      hold: true,
      headset: 'off',
      wake: { on: false, sensitivity: 0.5 },
    },
    listen: { mode: 'chosen', devices: [] },
    speak: { mode: 'with_music', device: null, voice, speed: 1, pitch: 0, replies: true },
    duck: 0.3,
    echo: 'auto',
    llm: true,
    boosts: { artists: [] },
  };
}

test('the engine gets the config with the names of the selected voice in all five languages', () => {
  const { names, ...rest } = engineConfig(config('loli'), LOCALES);
  assert.deepEqual(names, ['Loli', 'Лоля', '롤리']);
  assert.deepEqual(rest, config('loli'));
});

test('the names follow the voice when it changes', () => {
  const before = config('loli');
  const after = { ...before, speak: { ...before.speak, voice: 'moriarty' } };
  assert.deepEqual(engineConfig(after, LOCALES).names, ['Moriarty', 'Мориарти', '모리아티']);
  assert.deepEqual(engineConfig(config('af_heart'), LOCALES).names, ['Heart']);
  for (const id of VOICE_IDS) assert.ok(engineConfig(config(id), LOCALES).names.length > 0, id);
});
