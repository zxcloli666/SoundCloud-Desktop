import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadLocale, textOf } from '../scripts/settings-index-locale.mjs';
import { buildSettingsIndex } from '../scripts/settings-index.mjs';
import { buildDocs } from '../src/lib/settings-search/docs.ts';
import { buildSearchIndex, search } from '../src/lib/settings-search/search-index.ts';
import type { SearchDoc } from '../src/lib/settings-search/types.ts';

type Phrases = Record<string, string[]>;
type Query = { q: string; lang: string; want: string[] };

const ROOT = new URL('..', import.meta.url).pathname;
const LANGUAGES = ['en', 'ru', 'tr', 'ko', 'pt'];
const MIN_PHRASES = 5;
const MIN_HIT_AT_1 = 0.8;
const MIN_HIT_AT_3 = 0.95;
const BUDGET_MS = 1500;

const built = buildSettingsIndex(ROOT);
const locales = new Map(LANGUAGES.map((lang) => [lang, loadLocale(ROOT, lang)]));

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
}

function phraseFile(lang: string): Phrases {
  return readJson<Phrases>(`src/i18n/search/${lang}.json`);
}

function docsFor(lang: string): SearchDoc[] {
  const texts = (key: string) => [
    ...new Set([lang, 'en'].map((code) => textOf(locales.get(code)!, key)).filter(Boolean)),
  ];
  const categoryLabel = (category: string) => {
    const info = built.categories.find((item) => item.id === category);
    return info ? texts(info.labelKey) : [];
  };
  return buildDocs(built.entries, texts, [phraseFile('en'), phraseFile(lang)], categoryLabel);
}

function doc(id: string, fields: SearchDoc['fields']): SearchDoc {
  return { id, fields };
}

function ids(docs: SearchDoc[], query: string): string[] {
  return search(buildSearchIndex(docs), query).map((hit) => hit.id);
}

const sample: SearchDoc[] = [
  doc('volume', [
    { kind: 'title', text: 'Volume normalization' },
    { kind: 'context', text: 'Playback' },
  ]),
  doc('loud', [
    { kind: 'title', text: 'Громкость' },
    { kind: 'context', text: 'Playback' },
  ]),
  doc('cache', [
    { kind: 'title', text: 'Cache size' },
    { kind: 'context', text: 'Storage' },
  ]),
  doc('theme', [
    { kind: 'title', text: 'Theme' },
    { kind: 'phrase', text: 'тёмная тема' },
    { kind: 'context', text: 'Playback' },
  ]),
  doc('font', [{ kind: 'title', text: 'Interface font' }]),
];

test('index has no problems, unique ids, english titles and every category', () => {
  assert.deepEqual(built.problems, []);
  const idList = built.entries.map((entry) => entry.id);
  assert.equal(new Set(idList).size, idList.length);
  const english = locales.get('en')!;
  for (const entry of built.entries) {
    assert.ok(
      entry.title.some((key) => textOf(english, key)),
      `no english title for ${entry.id}`,
    );
  }
  for (const category of built.categories) {
    assert.ok(
      built.entries.some((entry) => entry.category === category.id),
      `category ${category.id} has no entries`,
    );
  }
});

test('phrase files cover the entries', () => {
  const known = new Set(built.entries.map((entry) => entry.id));
  for (const lang of ['ru', 'en']) {
    const phrases = phraseFile(lang);
    const thin = built.entries
      .filter((entry) => (phrases[entry.id]?.length ?? 0) < MIN_PHRASES)
      .map((entry) => entry.id);
    assert.deepEqual(thin, [], `${lang}: entries with fewer than ${MIN_PHRASES} phrases`);
  }
  for (const lang of LANGUAGES) {
    const stale = Object.keys(phraseFile(lang)).filter((id) => !known.has(id));
    assert.deepEqual(stale, [], `${lang}: ids that are not entries`);
  }
});

test('engine: typo', () => {
  assert.equal(ids(sample, 'volme normalizaton')[0], 'volume');
});

test('engine: prefix while typing', () => {
  assert.equal(ids(sample, 'norm')[0], 'volume');
  assert.equal(ids(sample, 'громк')[0], 'loud');
});

test('engine: inflection', () => {
  assert.equal(ids(sample, 'громкости')[0], 'loud');
});

test('engine: wrong keyboard layout', () => {
  assert.equal(ids(sample, 'uhjvrjcnm')[0], 'loud');
  assert.equal(ids(sample, 'сфсру')[0], 'cache');
});

test('engine: apostrophe layout', () => {
  const docs = [doc('cache', [{ kind: 'title', text: 'Кэш' }]), ...sample];
  assert.equal(ids(docs, "r'i")[0], 'cache');
});

test('engine: unknown words alone give no hit', () => {
  assert.deepEqual(ids(sample, 'qwxz vbnmk'), []);
});

test('engine: filler around one strong word still finds the doc', () => {
  assert.equal(ids(sample, 'please change that thing about my font today')[0], 'font');
});

test('engine: head of a longer query word does not match', () => {
  const docs = [
    doc('quality', [
      { kind: 'title', text: 'Качество' },
      { kind: 'option', text: 'Авто' },
    ]),
    doc('autoplay', [
      { kind: 'title', text: 'Автопродолжение' },
      { kind: 'phrase', text: 'автоплей' },
    ]),
  ];
  assert.deepEqual(ids(docs, 'автоплей'), ['autoplay']);
});

test('engine: context alone gives no hit', () => {
  assert.deepEqual(ids(sample, 'playback'), []);
  assert.deepEqual(ids(sample, 'storage'), []);
});

test('engine: interpolation is stripped', () => {
  const docs = buildDocs(
    [{ id: 'a', kind: 'card', category: 'x', card: 'a', title: ['k'], desc: [], keys: [] }],
    () => ['Cache {{count}} tracks'],
    [],
    () => [],
  );
  assert.equal(docs[0].fields[0].text.includes('{{'), false);
  assert.deepEqual(ids(docs, 'count'), []);
  assert.deepEqual(ids(docs, 'tracks'), ['a']);
});

function evaluate(file: string) {
  const queries = readJson<Query[]>(`tests/settings-search/${file}`);
  const started = performance.now();
  const indexes = new Map<string, ReturnType<typeof buildSearchIndex>>();
  const misses: string[] = [];
  const perLanguage = new Map<string, number[]>();
  let first = 0;
  let third = 0;

  for (const query of queries) {
    if (!indexes.has(query.lang)) indexes.set(query.lang, buildSearchIndex(docsFor(query.lang)));
    const top = search(indexes.get(query.lang)!, query.q).map((hit) => hit.id);
    const counts = perLanguage.get(query.lang) ?? [0, 0, 0];
    counts[0]++;
    perLanguage.set(query.lang, counts);
    if (query.want.includes(top[0])) {
      first++;
      counts[1]++;
    }
    if (top.slice(0, 3).some((id) => query.want.includes(id))) {
      third++;
      counts[2]++;
    } else {
      misses.push(
        `${query.q} -> ${top.slice(0, 3).join(', ') || '(none)'}, want ${query.want.join(', ')}`,
      );
    }
  }

  const total = performance.now() - started;
  console.log(
    `${file}: hit@1 ${first}/${queries.length}, hit@3 ${third}/${queries.length}, ` +
      `${(total / queries.length).toFixed(1)} ms per query, ${total.toFixed(0)} ms total`,
  );
  for (const [lang, [count, one, three]] of perLanguage) {
    console.log(`  ${lang}: hit@1 ${one}/${count}, hit@3 ${three}/${count}`);
  }
  if (misses.length > 0)
    console.log(`  misses:\n${misses.map((line) => `    ${line}`).join('\n')}`);

  assert.ok(first / queries.length >= MIN_HIT_AT_1, `hit@1 ${first}/${queries.length}`);
  assert.ok(third / queries.length >= MIN_HIT_AT_3, `hit@3 ${third}/${queries.length}`);
  assert.ok(total < BUDGET_MS, `${total} ms over budget`);
}

test('eval: queries.json', () => evaluate('queries.json'));

test('eval: holdout.json', () => evaluate('holdout.json'));
