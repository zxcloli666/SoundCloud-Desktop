import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  chatSettingsShown,
  gateOf,
  keychainText,
  keyStorageText,
  resetLinkText,
  resetWhereText,
} from '../src/lib/chat/gate.ts';
import { clockTime, soonTime } from '../src/lib/chat/time.ts';

type Tree = { [key: string]: string | Tree };

const LOCALES = join(new URL('..', import.meta.url).pathname, 'src/i18n/locales/chat');
const LANGUAGES = ['en', 'ru', 'pt', 'ko', 'tr'];
const OSES = ['mac', 'linux', 'windows'] as const;

function bundle(language: string): Tree {
  const area = (name: string) =>
    JSON.parse(readFileSync(join(LOCALES, `${name}.${language}.json`), 'utf8')) as Tree;
  return { chat: { relogin: area('relogin'), settings: area('settings') } };
}

function lookup(tree: Tree, key: string): unknown {
  let node: string | Tree | undefined = tree;
  for (const part of key.split('.')) {
    if (typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
}

function everyKey(): string[] {
  const keys = new Set<string>();
  for (const os of OSES) {
    for (const storage of ['os', 'file'] as const) {
      keys.add(keychainText('keychain_denied', storage, os));
      keys.add(keychainText('keychain_unavailable', storage, os));
      keys.add(keyStorageText(storage, os));
      keys.add(resetLinkText(storage));
    }
    for (const plan of ['file', 'probe', 'in_place'] as const) keys.add(resetWhereText(plan, os));
  }
  return [...keys];
}

test('a device limit shows while chats start and gives way to every other state', () => {
  assert.equal(gateOf(true, 'starting', true), 'limit');
  assert.equal(gateOf(true, 'starting', false), 'loading');
  assert.equal(gateOf(true, 'starting'), 'loading');
  assert.equal(gateOf(true, 'ready', true), 'open');
  assert.equal(gateOf(true, 'keychain_denied', true), 'keychain');
  assert.equal(gateOf(true, 'unbound', true), 'relogin');
  assert.equal(gateOf(false, 'starting', true), 'off');
});

test('chat settings show the keychain card even before the account config arrives', () => {
  assert.equal(chatSettingsShown(false, 'keychain_denied'), true);
  assert.equal(chatSettingsShown(false, 'keychain_unavailable'), true);
  assert.equal(chatSettingsShown(false, 'starting'), false);
  assert.equal(chatSettingsShown(false, 'unbound'), false);
  assert.equal(chatSettingsShown(false, null), false);
  assert.equal(chatSettingsShown(true, 'ready'), true);
});

test('the keychain card names the store the keys are really in', () => {
  assert.equal(keychainText('keychain_denied', 'os', 'mac'), 'chat.relogin.keychain.mac');
  assert.equal(
    keychainText('keychain_unavailable', 'os', 'linux'),
    'chat.relogin.keychain.unavailable.linux',
  );
  for (const os of OSES) {
    assert.equal(
      keychainText('keychain_unavailable', 'file', os),
      'chat.relogin.keychain.unavailable.file',
    );
    assert.equal(keyStorageText('file', os), 'chat.settings.keys.file');
  }
  assert.equal(keyStorageText('os', 'windows'), 'chat.settings.keys.os.windows');
  assert.equal(resetLinkText('os'), 'chat.relogin.keychain.reset.open');
  assert.equal(resetLinkText('file'), 'chat.relogin.keychain.reset.openFile');
});

test('the reset dialog says where the new keys go for every plan', () => {
  assert.equal(resetWhereText('probe', 'windows'), 'chat.relogin.keychain.reset.probe');
  assert.equal(resetWhereText('in_place', 'mac'), 'chat.relogin.keychain.reset.os.mac');
  assert.equal(resetWhereText('file', 'linux'), 'chat.relogin.keychain.reset.file.linux');
  assert.equal(resetWhereText('file', 'windows'), 'chat.relogin.keychain.reset.file.windows');
});

test('every key the reset helpers build exists in all five languages', () => {
  for (const language of LANGUAGES) {
    const tree = bundle(language);
    const missing = everyKey().filter((key) => typeof lookup(tree, key) !== 'string');
    assert.deepEqual(missing, [], language);
  }
});

test('a full account names its device maximum in every plural form of every language', () => {
  const names = (text: unknown) =>
    typeof text === 'string' ? [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]) : [];
  for (const language of LANGUAGES) {
    const tree = bundle(language);
    const rules = new Intl.PluralRules(language);
    const forms = new Set(Array.from({ length: 32 }, (_, index) => rules.select(index + 1)));
    for (const form of forms) {
      const title = lookup(tree, `chat.relogin.limit.cap.title_${form}`);
      assert.deepEqual(names(title), ['count'], `${language} ${form}`);
    }
    const remove = lookup(tree, 'chat.relogin.limit.cap.remove');
    assert.equal(typeof remove, 'string', language);
    assert.deepEqual(names(remove), [], language);
  }
});

test('the limit time is a clock today and a weekday with a clock tomorrow', () => {
  const now = new Date(2026, 10, 5, 9, 0).getTime();
  const later = new Date(2026, 10, 5, 18, 30).getTime();
  const tomorrow = new Date(2026, 10, 6, 8, 15).getTime();
  assert.equal(soonTime(later, now, 'en'), clockTime(later, 'en'));
  const weekday = new Intl.DateTimeFormat('en', { weekday: 'short' }).format(tomorrow);
  assert.ok(soonTime(tomorrow, now, 'en').includes(weekday));
  assert.ok(soonTime(tomorrow, now, 'en').includes('08:15'));
});
