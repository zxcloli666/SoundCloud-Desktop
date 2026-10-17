import { execFileSync } from 'node:child_process';

export function git(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

export function tryGit(root, args) {
  try {
    return git(root, args);
  } catch {
    return null;
  }
}

export function repoRoot() {
  return git(process.cwd(), ['rev-parse', '--show-toplevel']);
}

export function commitTime(root, rev) {
  const seconds = Number(git(root, ['log', '-1', '--format=%ct', rev]));
  return new Date(seconds * 1000).toISOString().replace('.000Z', 'Z');
}

export function previousIndex(root, ref) {
  if (!ref || !tryGit(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])) return null;
  const text = tryGit(root, ['show', `${ref}:v1/index.json`]);
  if (text === null) throw new Error(`${ref} has no v1/index.json`);
  const index = JSON.parse(text);
  if (!Array.isArray(index?.themes)) throw new Error(`${ref}:v1/index.json has no themes list`);
  return index;
}
