import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(import.meta.dirname, '..', 'src');
const RULES = [
  [/(^|[\s"'`:!])(?:[\w-]+:)*(text|bg|border|border-[trblxy]|ring|divide|from|via|to)-white\/[\d[]/, 'use ink: text-ink-40, bg-ink/[0.06], border-ink/10'],
  [/^(?!.*(shadow|inset|glow|filter)).*rgba?\(\s*255\s*,\s*255\s*,\s*255\s*,/i, 'use rgb(var(--ink) / a)'],
];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.tsx?$/.test(name)) yield path;
  }
}

const problems = [];
for (const path of files(root)) {
  const lines = readFileSync(path, 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const [pattern, hint] of RULES) {
      if (pattern.test(line)) problems.push(`${relative(root, path)}:${index + 1}: ${hint}`);
    }
  });
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(
    `\n${problems.length} hardcoded white colours. They break the white scheme, see "Цветовая схема" in desktop/CLAUDE.md.`,
  );
  process.exit(1);
}
