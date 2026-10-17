import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { git, previousIndex, repoRoot } from './git.mjs';
import { kib, print, table, writeSummary } from './summary.mjs';
import { listThemes, loadTheme, readRevoked } from './theme.mjs';

const MAINTAINERS = ['zxcloli666', 'github-actions[bot]'];

const { values, positionals } = parseArgs({
  options: { previous: { type: 'string' }, 'pr-author': { type: 'string' } },
  allowPositionals: true,
});

const root = repoRoot();
const buildRev = git(root, ['rev-parse', 'HEAD']);
let previous;
try {
  previous = previousIndex(root, values.previous);
} catch (error) {
  print(`error: previous index: ${error.message}`);
  process.exit(1);
}
const before = new Map((previous?.themes ?? []).map((theme) => [theme.id, theme]));
const present = listThemes(root);
const ids =
  positionals.length > 0 ? positionals : [...new Set([...present, ...before.keys()])].sort();
const prAuthor = values['pr-author']?.trim() || null;

const fingerprint = (entry) =>
  JSON.stringify([
    entry.hash,
    entry.version,
    entry.name,
    entry.description,
    entry.author,
    entry.license,
    entry.minApp ?? null,
    entry.preview?.sha256,
  ]);

const rows = [];
let failures = 0;

if (!readRevoked(root)) {
  failures++;
  print('error: themes/revoked.json must be a list of {id, hash, reason}');
  rows.push([
    'revoked.json',
    '-',
    'invalid',
    '-',
    '-',
    '-',
    ['must be a list of {id, hash, reason}'],
    [],
  ]);
}

for (const id of ids) {
  const old = before.get(id);
  if (!present.includes(id)) {
    if (old) {
      print(`warning: themes/${id}: removed`);
      rows.push([id, old.version, 'removed', '-', '-', '-', [], ['removed']]);
    } else {
      failures++;
      print(`error: themes/${id}: no such theme`);
      rows.push([id, '-', '-', '-', '-', '-', ['no such theme'], []]);
    }
    continue;
  }
  const { entry, errors, warnings } = loadTheme(join(root, 'themes', id), buildRev, old);
  let change = 'failed';
  if (entry) {
    const github = entry.author.github ?? null;
    const owners = [github, ...MAINTAINERS].filter(Boolean).map((login) => login.toLowerCase());
    const same = old && fingerprint(old) === fingerprint(entry);
    if (!same && prAuthor && !owners.includes(prAuthor.toLowerCase())) {
      warnings.push(
        `themes/${id}: changed by ${prAuthor}, the author is ${github ?? 'not on GitHub'}`,
      );
    }
    const oldGithub = old?.author?.github ?? null;
    if (old && oldGithub !== github) {
      warnings.push(
        `themes/${id}/theme.json: author.github changed from ${oldGithub} to ${github}`,
      );
    }
    if (!old) change = 'new';
    else if (old.hash !== entry.hash) change = `${old.version} -> ${entry.version}`;
    else change = same ? 'same' : 'metadata';
  }
  for (const line of errors) print(`error: ${line}`);
  for (const line of warnings) print(`warning: ${line}`);
  if (errors.length > 0) failures++;
  rows.push([
    id,
    entry?.version ?? '-',
    change,
    entry ? kib(entry.css.size) : '-',
    entry ? kib(entry.size - entry.css.size) : '-',
    entry ? kib(entry.preview.size) : '-',
    errors,
    warnings,
  ]);
}

const head = ['Theme', 'Version', 'Change', 'CSS', 'Assets', 'Preview', 'Errors', 'Warnings'];
writeSummary(`### Themes check\n\n${table(head, rows)}`);
console.log(`${ids.length} checked, ${failures} with errors`);
process.exit(failures > 0 ? 1 : 0);
