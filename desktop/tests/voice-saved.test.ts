import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SAVED_VERSION, upgradeSaved } from '../src/lib/voice/saved.ts';
import type { VoiceConfig } from '../src/lib/voice/types.ts';

const silent = () => ({ enabled: true, language: 'en', llm: false }) as unknown as VoiceConfig;

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
