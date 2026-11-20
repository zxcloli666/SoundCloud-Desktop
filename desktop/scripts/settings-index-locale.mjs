import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PLURAL = /_(zero|one|two|few|many|other)$/;
const BROAD_LIMIT = 80;

export function loadLocale(root, language) {
  const dir = join(root, 'src/i18n/locales');
  const leaves = new Map();
  flatten(JSON.parse(readFileSync(join(dir, `${language}.json`), 'utf8')), '', leaves);
  for (const file of readdirSync(join(dir, 'chat'))) {
    const match = file.match(/^(\w+)\.(\w+)\.json$/);
    if (match?.[2] !== language) continue;
    const tree = JSON.parse(readFileSync(join(dir, 'chat', file), 'utf8'));
    flatten(tree, `chat.${match[1]}.`, leaves);
  }
  flatten(JSON.parse(readFileSync(join(dir, 'voice', `${language}.json`), 'utf8')), '', leaves);
  return leaves;
}

export function textOf(leaves, key) {
  return leaves.get(key) ?? leaves.get(`${key}_other`) ?? '';
}

export function createKeyIndex(leaves) {
  const keys = new Set();
  for (const key of leaves.keys()) {
    const base = key.replace(PLURAL, '');
    keys.add(base !== key && leaves.has(`${base}_other`) ? base : key);
  }
  const list = [...keys];
  return {
    has: (text) => keys.has(text),
    expand: (head, tail) => list.filter((key) => key.startsWith(head) && key.endsWith(tail)),
    broadLimit: BROAD_LIMIT,
  };
}

function flatten(tree, prefix, out) {
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === 'string') out.set(prefix + key, value);
    else if (value && typeof value === 'object') flatten(value, `${prefix}${key}.`, out);
  }
}
