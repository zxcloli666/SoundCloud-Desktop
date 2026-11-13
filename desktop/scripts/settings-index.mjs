import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createKeyIndex, loadLocale, textOf } from './settings-index-locale.mjs';
import { parseFile, readImports } from './settings-index-parse.mjs';
import { walkFile } from './settings-index-walk.mjs';

const HIDDEN = new Set([
  'chat.settings.loadFailed',
  'chat.settings.title',
  'voice.activation.wake',
  'voice.locked.voices',
]);

const CUSTOM_CARDS = new Map([
  ['src/components/settings/CallProxySection.tsx', 'call.title'],
  ['src/components/voice/VoiceSettings.tsx', 'voice.assistant'],
]);

export function buildSettingsIndex(root) {
  const source = parseFile(join(root, 'src/components/settings/registry.tsx'));
  const imports = readImports(source);
  const english = loadLocale(root, 'en');
  const primitives = join(root, 'src/components/settings/primitives.tsx');
  const ctx = {
    root,
    primitives,
    keyIndex: createKeyIndex(english),
    hidden: HIDDEN,
    customCards: CUSTOM_CARDS,
    entries: new Map(),
    problems: [],
    category: '',
    relative: (file) => relative(root, file),
    walkable: (file) =>
      file !== primitives &&
      file.startsWith(join(root, 'src/components/')) &&
      !file.startsWith(join(root, 'src/components/ui/')),
  };

  const categories = readCategories(source);
  for (const category of categories) {
    ctx.category = category.id;
    for (const tag of category.tags) {
      const binding = imports.get(tag);
      if (binding) walkFile(ctx, binding.file, null, [source.fileName], true);
    }
  }

  const entries = leaveRowKeysOut([...ctx.entries.values()].map(tidy));
  return {
    entries,
    problems: ctx.problems,
    categories: categories.map(({ id, labelKey }) => ({ id, labelKey })),
  };
}

function readCategories(source) {
  const categories = [];
  const visit = (node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const id = property(node, 'id');
      const body = property(node, 'Body');
      if (id && body && ts.isStringLiteral(id)) {
        categories.push({
          id: id.text,
          labelKey: property(node, 'labelKey').text,
          tags: tagsIn(body),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return categories;
}

function property(object, name) {
  const found = object.properties.find(
    (item) => ts.isPropertyAssignment(item) && item.name.getText() === name,
  );
  return found?.initializer;
}

function tagsIn(node) {
  const tags = [];
  const visit = (child) => {
    const opening = ts.isJsxElement(child) ? child.openingElement : child;
    if (ts.isJsxOpeningElement(opening) || ts.isJsxSelfClosingElement(opening)) {
      if (ts.isIdentifier(opening.tagName)) tags.push(opening.tagName.text);
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return tags;
}

function tidy({ marked, ...entry }) {
  const title = unique(entry.title);
  const loose = unique(entry.keys);
  const desc = unique(marked ? loose.filter((key) => key.endsWith('Desc')) : entry.desc).filter(
    (key) => !title.includes(key),
  );
  const own = new Set([...title, ...desc]);
  return { ...entry, title, desc, keys: loose.filter((key) => !own.has(key)) };
}

function leaveRowKeysOut(entries) {
  const taken = new Map();
  for (const row of entries.filter((entry) => entry.kind === 'row')) {
    const keys = taken.get(row.card) ?? new Set();
    for (const key of [...row.title, ...row.desc, ...row.keys]) keys.add(key);
    taken.set(row.card, keys);
  }
  return entries.map((entry) =>
    entry.kind === 'card' && taken.has(entry.id)
      ? { ...entry, keys: entry.keys.filter((key) => !taken.get(entry.id).has(key)) }
      : entry,
  );
}

function unique(list) {
  return [...new Set(list)];
}

function main() {
  const root = join(import.meta.dirname, '..');
  const result = buildSettingsIndex(root);
  if (process.argv.includes('--json')) {
    const english = loadLocale(root, 'en');
    const russian = loadLocale(root, 'ru');
    const resolve = (leaves, keys) => keys.map((key) => textOf(leaves, key));
    const entries = result.entries.map((entry) => ({
      ...entry,
      en: { title: resolve(english, entry.title), desc: resolve(english, entry.desc) },
      ru: { title: resolve(russian, entry.title), desc: resolve(russian, entry.desc) },
    }));
    console.log(JSON.stringify({ entries, problems: result.problems }, null, 2));
    return;
  }
  printTable(result, loadLocale(root, 'en'));
}

function printTable(result, english) {
  for (const category of result.categories) {
    const own = result.entries.filter((entry) => entry.category === category.id);
    console.log(`\n${category.id} (${own.length})`);
    for (const entry of own) {
      const title = entry.title.map((key) => textOf(english, key)).join(' / ');
      console.log(
        `  ${entry.kind.padEnd(4)} ${entry.id.padEnd(48)} ${title}  [${entry.keys.length} keys]`,
      );
    }
  }
  console.log(`\nproblems (${result.problems.length})`);
  for (const problem of result.problems) console.log(`  ${problem}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
