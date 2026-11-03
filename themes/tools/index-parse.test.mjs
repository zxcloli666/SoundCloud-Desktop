import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  fileUrl,
  indexUrl,
  localName,
  parseIndex,
  pickDescription,
} from '../../desktop/src/lib/themes/index-parse.ts';

const sha = (char) => char.repeat(64);
const rev = (char) => char.repeat(40);
const RAW = 'https://raw.githubusercontent.com/zxcloli666/SoundCloud-Desktop';

function entry(overrides = {}) {
  return {
    id: 'midnight',
    rev: rev('a'),
    name: 'Midnight',
    description: { ru: 'Глубокий синий', en: 'Deep blue' },
    version: '1.0.0',
    author: { name: 'SoundCloud Desktop', github: 'zxcloli666' },
    license: 'MIT',
    accent: '#7aa2ff',
    background: '#070a12',
    font: 'onest',
    updated: '2026-10-17T11:58:00Z',
    hash: sha('b'),
    size: 9120 + 9222,
    preview: { path: 'preview.webp', sha256: sha('c'), size: 151000, width: 1280, height: 800 },
    css: { path: 'theme.css', sha256: sha('d'), size: 9120 },
    assets: [{ path: 'assets/stars.svg', sha256: sha('e'), size: 9222 }],
    ...overrides,
  };
}

function index(themes, overrides = {}) {
  return {
    schema: 1,
    generated: '2026-10-17T12:00:00Z',
    rev: rev('f'),
    themes,
    revoked: [{ id: 'old-theme', hash: sha('9') }],
    ...overrides,
  };
}

const ids = (catalog) => catalog.themes.map((theme) => theme.id);

test('parses a valid index', () => {
  const catalog = parseIndex(
    index([entry(), entry({ id: 'carbon', font: undefined, scheme: 'white' })]),
    '8.5.2',
  );
  assert.deepEqual(ids(catalog), ['midnight', 'carbon']);
  assert.equal(catalog.rev, rev('f'));
  assert.deepEqual(catalog.revoked, [{ id: 'old-theme', hash: sha('9') }]);
  const [midnight, carbon] = catalog.themes;
  assert.equal(midnight.compatible, true);
  assert.equal(midnight.font, 'onest');
  assert.equal(carbon.font, undefined);
  assert.equal(midnight.scheme, undefined);
  assert.equal(carbon.scheme, 'white');
  assert.equal(midnight.assets[0].path, 'assets/stars.svg');
});

test('unknown schema returns null', () => {
  assert.equal(parseIndex(index([entry()], { schema: 2 }), '8.5.2'), null);
  assert.equal(parseIndex(null, '8.5.2'), null);
  assert.equal(parseIndex([], '8.5.2'), null);
});

test('bad top rev returns null', () => {
  assert.equal(parseIndex(index([entry()], { rev: 'main' }), '8.5.2'), null);
  assert.equal(parseIndex(index([entry()], { rev: rev('F') }), '8.5.2'), null);
});

test('bad entries are skipped, the rest stay', () => {
  const bad = [
    entry({ id: 'bad-rev', rev: 'refs/heads/main' }),
    entry({ id: 'Bad_Id' }),
    entry({ id: 'tools' }),
    entry({ id: 'dots', css: { path: '../theme.css', sha256: sha('d'), size: 9120 } }),
    entry({
      id: 'dotdot-asset',
      assets: [{ path: 'assets/../x.svg', sha256: sha('e'), size: 9222 }],
    }),
    entry({ id: 'bad-sha', hash: 'abc' }),
    entry({
      id: 'big-asset',
      size: 9120 + 2_000_000,
      assets: [{ path: 'assets/stars.svg', sha256: sha('e'), size: 2_000_000 }],
    }),
    entry({ id: 'bad-color', accent: '#FFF' }),
    entry({ id: 'bad-font', font: 'comic-sans' }),
    entry({ id: 'bad-scheme', scheme: 'light' }),
    entry({ id: 'bidi-name', name: 'Mid‮night' }),
    entry({ id: 'bad-size', size: 1 }),
  ];
  const catalog = parseIndex(index([...bad, entry()]), '8.5.2');
  assert.deepEqual(ids(catalog), ['midnight']);
});

test('an entry with a revoked hash is skipped', () => {
  const catalog = parseIndex(index([entry(), entry({ id: 'old-theme', hash: sha('9') })]), '8.5.2');
  assert.deepEqual(ids(catalog), ['midnight']);
});

test('minApp compares numerically', () => {
  const catalog = parseIndex(
    index([entry({ minApp: '8.6.0' }), entry({ id: 'future', minApp: '8.11.0' })]),
    '8.10.0',
  );
  assert.deepEqual(
    catalog.themes.map((theme) => theme.compatible),
    [true, false],
  );
  const old = parseIndex(index([entry({ minApp: '8.6.0' })]), '8.5.2');
  assert.equal(old.themes[0].compatible, false);
});

test('file urls use the entry rev, not the top rev', () => {
  const [theme] = parseIndex(index([entry()]), '8.5.2').themes;
  assert.equal(
    fileUrl(RAW, theme.rev, theme.id, theme.css.path),
    `${RAW}/${rev('a')}/themes/midnight/theme.css`,
  );
  assert.equal(indexUrl(RAW), `${RAW}/refs/heads/themes-dist/v1/index.json`);
  assert.equal(localName(theme.assets[0]), `${sha('e')}.svg`);
});

test('description falls back to en, then ru, then any', () => {
  const both = { ru: 'Синий', en: 'Blue' };
  assert.equal(pickDescription(both, 'ru'), 'Синий');
  assert.equal(pickDescription(both, 'ko'), 'Blue');
  assert.equal(pickDescription({ ru: 'Синий', tr: 'Mavi' }, 'ko'), 'Синий');
  assert.equal(pickDescription({ tr: 'Mavi' }, 'en'), 'Mavi');
});
