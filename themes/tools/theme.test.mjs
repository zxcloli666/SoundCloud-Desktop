import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import * as rules from '../../desktop/src/lib/themes/rules.ts';
import { md, table } from './summary.mjs';
import { loadTheme } from './theme.mjs';

const fixtures = join(import.meta.dirname, 'fixtures');
const load = (id, previous) => loadTheme(join(fixtures, id), null, previous);
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

function assertError(id, pattern) {
  const { entry, errors } = load(id);
  assert.equal(entry, null);
  assert.ok(
    errors.some((line) => pattern.test(line)),
    errors.join('\n'),
  );
}

function copyTheme(id) {
  const dir = join(mkdtempSync(join(tmpdir(), 'themes-')), id);
  cpSync(join(fixtures, 'good-theme'), dir, { recursive: true });
  const meta = JSON.parse(readFileSync(join(dir, 'theme.json'), 'utf8'));
  writeFileSync(join(dir, 'theme.json'), JSON.stringify({ ...meta, id }));
  return dir;
}

test('the good theme passes and builds an entry', () => {
  const { entry, errors, warnings } = load('good-theme');
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.equal(entry.id, 'good-theme');
  assert.deepEqual(entry.description, { en: 'A test theme', ru: 'Тестовая тема' });
  assert.deepEqual(entry.author, { name: 'Tester', github: 'tester' });
  assert.deepEqual(
    entry.assets.map((asset) => asset.path),
    ['assets/dots.svg', 'assets/glow.png'],
  );
  assert.deepEqual(
    { path: entry.preview.path, width: entry.preview.width, height: entry.preview.height },
    { path: 'preview.png', width: 960, height: 600 },
  );
  assert.equal(entry.size, entry.css.size + entry.assets[0].size + entry.assets[1].size);
  const key = JSON.stringify([
    entry.css.sha256,
    entry.assets.map((asset) => [asset.path, asset.sha256]),
    '#7aa2ff',
    '#070a12',
    'onest',
  ]);
  assert.equal(entry.hash, sha256(key));
  assert.equal(entry.minApp, undefined);
});

test('a bad id fails', () => assertError('bad-id', /bad-id\/theme\.json: id must be/));
test('an unknown key fails', () => assertError('unknown-key', /homepage is not a known key/));
test('a bidi character in the name fails', () =>
  assertError('bidi-name', /name must be 1-32 plain/));
test('an unused asset fails', () => assertError('unused-asset', /assets\/extra\.png: not used/));
test('a bad svg fails', () => assertError('bad-svg', /assets\/evil\.svg: <script> is not allowed/));
test('a wrong preview ratio fails', () => assertError('wrong-ratio', /preview\.png: 1000x1000/));

test('changed files need a higher version', () => {
  const good = load('good-theme').entry;
  assert.deepEqual(load('good-theme', good).errors, []);
  const changed = { ...good, hash: 'f'.repeat(64) };
  const result = load('good-theme', changed);
  assert.equal(result.entry, null);
  assert.match(result.errors.join('\n'), /version must go up from 1\.0\.0/);
  assert.deepEqual(load('good-theme', { ...changed, version: '0.10.0' }).errors, []);
  assert.match(load('good-theme', { ...changed, version: '1.0.1' }).errors.join('\n'), /go up/);
});

test('a missing preview is an error', () => {
  const dir = copyTheme('no-preview');
  rmSync(join(dir, 'preview.png'));
  const result = loadTheme(dir, null);
  assert.equal(result.entry, null);
  assert.match(result.errors.join('\n'), /needs exactly one preview/);
});

test('theme.schema.json matches rules.ts', () => {
  const schema = JSON.parse(
    readFileSync(join(import.meta.dirname, '..', 'theme.schema.json'), 'utf8'),
  );
  const { properties, $defs } = schema;
  assert.equal(schema.additionalProperties, false);
  assert.equal(properties.id.pattern, rules.THEME_ID.source);
  assert.deepEqual(properties.id.not.enum, [...rules.THEME_RESERVED_IDS]);
  assert.equal($defs.version.pattern, rules.SEMVER.source);
  assert.equal($defs.color.pattern, rules.HEX_COLOR.source);
  assert.equal(properties.author.properties.github.pattern, rules.GITHUB_LOGIN.source);
  assert.deepEqual(properties.license.enum, [...rules.THEME_LICENSES]);
  assert.deepEqual(properties.font.enum, [...rules.THEME_FONTS]);
  assert.deepEqual(Object.keys(properties.description.properties), [...rules.THEME_LANGS]);
  assert.equal(properties.description.maxProperties, rules.THEME_LANGS.length);
  assert.equal($defs.name.maxLength, rules.TEXT_LIMITS.name);
  assert.equal($defs.description.maxLength, rules.TEXT_LIMITS.description);
  assert.equal($defs.authorName.maxLength, rules.TEXT_LIMITS.authorName);
});

test('md leaves no markdown or link syntax', () => {
  const text = '[x](https://e.com) ![i](a.png) <b> | `c` *d* _e_ #1 @u ~f~ & +g\\ {h}\r\nwww.e.com';
  const escaped = md(text);
  assert.doesNotMatch(escaped.replace(/&#\d+;/g, ''), /[\\`*_{}[\]()<>#+!|~&:.@\r\n]/);
  assert.equal(
    escaped.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code)),
    text,
  );
  assert.equal(table(['a'], [['x|y'], [['p', 'q']]]), '| a |\n| --- |\n| x&#124;y |\n| p<br>q |');
});

test('os files are skipped', () => {
  const dir = copyTheme('os-files');
  writeFileSync(join(dir, '.DS_Store'), 'x');
  writeFileSync(join(dir, 'Thumbs.db'), 'x');
  writeFileSync(join(dir, 'assets', '.DS_Store'), 'x');
  writeFileSync(join(dir, 'assets', 'desktop.ini'), 'x');
  const result = loadTheme(dir, null);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.entry.assets.map((asset) => asset.path),
    ['assets/dots.svg', 'assets/glow.png'],
  );
});

test('a huge image asset fails', () => {
  const dir = copyTheme('huge-asset');
  const png = readFileSync(join(dir, 'assets', 'glow.png'));
  png.writeUInt32BE(5000, 16);
  writeFileSync(join(dir, 'assets', 'glow.png'), png);
  const result = loadTheme(dir, null);
  assert.equal(result.entry, null);
  assert.match(result.errors.join('\n'), /glow\.png: 5000x\d+ is over 4096 px/);
});
