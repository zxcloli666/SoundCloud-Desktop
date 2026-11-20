import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CREDIT_GROUPS, CREDITS } from '../src/lib/voice/credits.ts';

const LANGUAGES = ['en', 'ru', 'tr', 'ko', 'pt'];
const VOICE = new URL('../../utils/voice/', import.meta.url);

function strings(lang: string): {
  group: Record<string, string>;
  use: Record<string, string>;
} {
  const url = new URL(`../src/i18n/locales/voice/${lang}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')).voice.credits;
}

test('every model of the manifest is credited', () => {
  const manifest = JSON.parse(readFileSync(new URL('voice-models/manifest.json', VOICE), 'utf8'));
  const credited = CREDITS.flatMap((credit) => credit.models ?? []);
  for (const model of manifest.models) {
    const covered = credited.some((prefix) => model.id.startsWith(prefix));
    assert.ok(covered, model.id);
  }
});

test('every data file shipped with the pronunciation crate is credited', () => {
  const shipped = readdirSync(new URL('voice-g2p/data/', VOICE)).filter(
    (name) => name !== 'LICENSES.txt',
  );
  const credited = CREDITS.flatMap((credit) => credit.files ?? []);
  assert.deepEqual([...shipped].sort(), [...credited].sort());
});

test('every credit has its group and use named in all five languages', () => {
  for (const lang of LANGUAGES) {
    const { group, use } = strings(lang);
    assert.deepEqual(Object.keys(group).sort(), [...CREDIT_GROUPS].sort(), lang);
    for (const credit of CREDITS) assert.ok(use[credit.use], `${lang}: ${credit.use}`);
    const used = new Set(CREDITS.map((credit) => credit.use));
    for (const key of Object.keys(use)) assert.ok(used.has(key as never), `${lang}: stale ${key}`);
  }
});

test('credit ids are unique and every link is https', () => {
  assert.equal(new Set(CREDITS.map((credit) => credit.id)).size, CREDITS.length);
  for (const credit of CREDITS) assert.match(credit.url, /^https:\/\//, credit.id);
});
