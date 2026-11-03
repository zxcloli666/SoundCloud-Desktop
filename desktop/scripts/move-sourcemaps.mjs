import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist', import.meta.url));
const maps = fileURLToPath(new URL('../dist-maps', import.meta.url));

rmSync(maps, { recursive: true, force: true });

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(path);
    } else if (entry.name.endsWith('.map')) {
      const target = join(maps, relative(dist, path));
      mkdirSync(dirname(target), { recursive: true });
      renameSync(path, target);
    }
  }
}

walk(dist);
