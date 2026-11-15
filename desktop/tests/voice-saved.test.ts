import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBody } from '../src/lib/voice/chat/body.ts';
import { mergeConfig, SAVED_VERSION, upgradeSaved } from '../src/lib/voice/saved.ts';
import type { VoiceConfig } from '../src/lib/voice/types.ts';

const silent = () => ({ enabled: true, language: 'en', llm: false }) as unknown as VoiceConfig;

const BASE: VoiceConfig = {
  enabled: false,
  language: 'ru',
  activation: { hotkey: null, hold: true, headset: 'off', wake: { on: false, sensitivity: 0.5 } },
  listen: { mode: 'chosen', devices: [] },
  speak: {
    mode: 'with_music',
    device: null,
    voice: 'loli',
    speed: 1,
    pitch: 0,
    replies: true,
    server: false,
  },
  duck: 0.3,
  echo: 'auto',
  llm: true,
  boosts: { artists: [] },
  listener: { gender: null, name: '', address: null },
  relation: { role: null, own: '' },
};

function beforeListener(): Partial<VoiceConfig> {
  const { listener: _listener, relation: _relation, ...old } = BASE;
  return { ...old, enabled: true, speak: { ...BASE.speak, voice: 'moriarty' } };
}

test('settings saved before the chat existed get the chat turned on', () => {
  const saved = { config: silent(), notes: 'keep me' };
  const upgraded = upgradeSaved(saved, SAVED_VERSION - 1);
  assert.equal(upgraded.config.llm, true);
  assert.deepEqual({ ...upgraded.config, llm: false }, saved.config);
  assert.equal(upgraded.notes, 'keep me');
  assert.equal(saved.config.llm, false);
});

test('settings of the current version stay as the user left them', () => {
  const saved = { config: silent() };
  assert.equal(upgradeSaved(saved, SAVED_VERSION), saved);
  assert.equal(upgradeSaved(saved, SAVED_VERSION + 1).config.llm, false);
});

test('a save without settings is left alone', () => {
  const saved = { notes: 'only notes' };
  assert.equal(upgradeSaved(saved, SAVED_VERSION - 1), saved);
});

test('settings saved before the listener and the role existed load with both unset', () => {
  const merged = mergeConfig(BASE, beforeListener());
  assert.deepEqual(merged.listener, { gender: null, name: '', address: null });
  assert.deepEqual(merged.relation, { role: null, own: '' });
  assert.equal(merged.enabled, true);
  assert.equal(merged.speak.voice, 'moriarty');
  const body = buildBody({
    text: 'привет',
    persona: merged.speak.voice,
    language: merged.language,
    context: {},
    history: [],
    notes: [],
    tools: [],
    results: [],
    quiet: false,
    listener: merged.listener,
    relation: merged.relation,
  });
  assert.ok(!('listener' in body));
  assert.ok(!('relation' in body));
});

test('a saved listener and role are kept, missing fields come from the defaults', () => {
  const saved = {
    ...BASE,
    listener: { name: 'Аня' },
    relation: { role: 'own', own: 'Соседка по плейлисту' },
  } as unknown as Partial<VoiceConfig>;
  const merged = mergeConfig(BASE, saved);
  assert.deepEqual(merged.listener, { gender: null, name: 'Аня', address: null });
  assert.deepEqual(merged.relation, { role: 'own', own: 'Соседка по плейлисту' });
});
