import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const ROOT = new URL('..', import.meta.url).pathname;
const CAPABILITIES = ['src-tauri/capabilities/default.json', 'src-tauri/dev/remote.json'];

interface Scope {
  allow: string[];
  deny: string[];
}

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function appDataFiles(): Set<string> {
  const files = new Set<string>();
  for (const path of sources(join(ROOT, 'src'))) {
    const text = readFileSync(path, 'utf8');
    if (text.includes('tauri-storage')) {
      for (const match of text.matchAll(/name:\s*'([^']+)',[^}]{0,160}?storage:/gs)) {
        files.add(`${match[1]}.json`);
      }
      for (const match of text.matchAll(/const [A-Z_]+_KEY = '([^']+)'/g)) {
        files.add(`${match[1]}.json`);
      }
    }
    if (text.includes('BaseDirectory.AppData')) {
      for (const match of text.matchAll(/= '([\w./-]+\.json)'/g)) files.add(match[1]);
    }
  }
  return files;
}

function scope(capability: string): Scope {
  const data = JSON.parse(readFileSync(join(ROOT, capability), 'utf8'));
  const entry = data.permissions.find(
    (permission: unknown) =>
      typeof permission === 'object' &&
      (permission as { identifier?: string }).identifier === 'fs:scope',
  );
  const paths = (list: { path: string }[]) => list.map((item) => item.path);
  return { allow: paths(entry.allow), deny: paths(entry.deny) };
}

function covers(pattern: string, file: string): boolean {
  const path = `$APPDATA/${file}`;
  if (pattern === path) return true;
  if (pattern.endsWith('/**')) return path.startsWith(pattern.slice(0, -2));
  if (pattern.endsWith('/*')) {
    const dir = pattern.slice(0, -1);
    return path.startsWith(dir) && !path.slice(dir.length).includes('/');
  }
  return false;
}

const files = appDataFiles();

test('the scan finds the stores that live in app data', () => {
  for (const file of ['star-moments.json', 'sc-settings.json', 'offline-index.json']) {
    assert.ok(files.has(file), file);
  }
});

for (const capability of CAPABILITIES) {
  const { allow, deny } = scope(capability);

  test(`${capability} lets the webview reach every store file`, () => {
    const missing = [...files].filter((file) => !allow.some((pattern) => covers(pattern, file)));
    assert.deepEqual(missing, []);
  });

  test(`${capability} lists app data files by exact name and none unused`, () => {
    const top = allow.filter((pattern) => /^\$APPDATA\/[^/]+\.json$/.test(pattern));
    assert.deepEqual(
      top.filter((pattern) => pattern.includes('*')),
      [],
    );
    const unused = top.filter((pattern) => ![...files].some((file) => covers(pattern, file)));
    assert.deepEqual(unused, []);
  });

  test(`${capability} keeps the session and chat files closed`, () => {
    const closed = ['$APPDATA/sc-auth.json'];
    for (const dir of ['chat', 'chat-dev']) closed.push(`$APPDATA/${dir}`, `$APPDATA/${dir}/**`);
    for (const path of closed) assert.ok(deny.includes(path), path);
    assert.ok(!allow.some((pattern) => covers(pattern, 'sc-auth.json')));
    assert.ok(!allow.some((pattern) => covers(pattern, 'chat/chat.db')));
    assert.ok(!allow.some((pattern) => covers(pattern, 'chat-dev/chat.db')));
  });
}
