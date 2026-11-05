import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

type Tree = { [key: string]: string | Tree };

const ROOT = new URL('..', import.meta.url).pathname;
const LOCALES = join(ROOT, 'src/i18n/locales/chat');
const PLURAL = /_(zero|one|two|few|many|other)$/;

function bundle(language: string): Tree {
  const tree: Tree = {};
  for (const file of readdirSync(LOCALES)) {
    const match = file.match(/^(\w+)\.(\w+)\.json$/);
    if (match && match[2] === language) {
      tree[match[1]] = JSON.parse(readFileSync(join(LOCALES, file), 'utf8'));
    }
  }
  return { chat: tree };
}

function leaves(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : leaves(value, `${prefix}${key}.`),
  );
}

function lookup(tree: Tree, key: string): string | Tree | undefined {
  let node: string | Tree | undefined = tree;
  for (const part of key.split('.')) {
    if (typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
}

function pluralForms(language: string): string[] {
  const rules = new Intl.PluralRules(language);
  return [...new Set([0, 1, 2, 5, 21, 1_000_000].map((n) => rules.select(n)))];
}

function resolves(tree: Tree, key: string, forms: string[]): boolean {
  if (typeof lookup(tree, key) === 'string') return true;
  return forms.every((form) => typeof lookup(tree, `${key}_${form}`) === 'string');
}

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'lab' ? [] : sources(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function keysInCode(areas: Set<string>): Set<string> {
  const keys = new Set<string>();
  for (const path of sources(join(ROOT, 'src'))) {
    const text = readFileSync(path, 'utf8');
    for (const match of text.matchAll(/['"`](chat\.[A-Za-z0-9_.]+)['"`]/g)) {
      const key = match[1].replace(/\.$/, '');
      if (areas.has(key.split('.')[1])) keys.add(key);
    }
  }
  return keys;
}

const en = bundle('en');
const pt = bundle('pt');
const areas = new Set(Object.keys(en.chat as Tree));

test('every English chat string has a Portuguese one with all plural forms', () => {
  const forms = pluralForms('pt');
  const missing = [...new Set(leaves(en).map((key) => key.replace(PLURAL, '')))].filter(
    (key) => !resolves(pt, key, forms),
  );
  assert.deepEqual(missing, []);
});

test('every chat key used in code resolves in Portuguese and English', () => {
  const keys = keysInCode(areas);
  assert.ok(keys.size > 300, `only ${keys.size} keys found`);
  const unresolved = [...keys].filter((key) => {
    if (typeof lookup(en, key) === 'object') return false;
    return !resolves(pt, key, pluralForms('pt')) || !resolves(en, key, pluralForms('en'));
  });
  assert.deepEqual(unresolved, []);
});

test('Portuguese keeps the placeholders of English', () => {
  const broken = leaves(pt).filter((key) => {
    const english = lookup(en, key) ?? lookup(en, key.replace(PLURAL, '_other'));
    if (typeof english !== 'string') return true;
    const names = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
    return names(english).join() !== names(lookup(pt, key) as string).join();
  });
  assert.deepEqual(broken, []);
});
