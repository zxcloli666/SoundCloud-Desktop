import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = join(import.meta.dirname, '..', '..');
const src = join(root, 'desktop', 'src');

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (name.endsWith('.tsx')) yield path;
  }
}

const code = [...files(src)].map((path) => readFileSync(path, 'utf8')).join('\n');

function documented(doc) {
  const text = readFileSync(join(root, 'docs', doc), 'utf8');
  return new Set([...text.matchAll(/\[data-ui="([a-z-]+)"\]/g)].map((match) => match[1]));
}

test('every documented hook is in the app', () => {
  for (const doc of ['CUSTOM_CSS.md', 'CUSTOM_CSS.ru.md']) {
    for (const hook of documented(doc)) {
      assert.ok(code.includes(`data-ui="${hook}"`), `${doc}: ${hook} is not in desktop/src`);
    }
  }
});

test('both guides list the same hooks', () => {
  assert.deepEqual(documented('CUSTOM_CSS.ru.md'), documented('CUSTOM_CSS.md'));
});

test('the custom CSS card offers only documented hooks', () => {
  const card = readFileSync(join(src, 'components/settings/cards/CustomCssCard.tsx'), 'utf8');
  const start = card.indexOf('const HOOKS');
  const list = card.slice(start, card.indexOf('];', start));
  const hooks = new Set([...list.matchAll(/'([a-z-]+)'/g)].map((match) => match[1]));
  const known = documented('CUSTOM_CSS.md');
  assert.ok(hooks.size > 0);
  for (const hook of hooks) assert.ok(known.has(hook), `${hook} is not in docs/CUSTOM_CSS.md`);
});
