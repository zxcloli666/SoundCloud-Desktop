const CAP = 400;
const LATIN = /[a-z]/i;
const CYRILLIC = /[а-яё]/i;
const MARK = /\[\[([^|\]]+)\|([^\]]+)\]\]/g;

export type Readings = Record<string, string>;

export function learned(readings: Readings, pairs: [string, string][]): Readings {
  const next = { ...readings };
  for (const [name, said] of pairs) {
    const key = keyOf(name);
    const reading = said.trim().replace(/\s+/g, ' ');
    if (!fits(key, reading)) continue;
    delete next[key];
    next[key] = reading;
  }
  const keys = Object.keys(next);
  for (const key of keys.slice(0, Math.max(0, keys.length - CAP))) delete next[key];
  return next;
}

export function marked(kept: string): [string, string][] {
  return [...kept.matchAll(MARK)].map((m) => [m[1], m[2]]);
}

export function spoken(readings: Readings, text: string): string {
  const lower = text.toLowerCase();
  const known = Object.keys(readings)
    .filter((key) => lower.includes(key))
    .sort((a, b) => b.length - a.length);
  return known.reduce((out, key) => out.replace(wordOf(key), () => titled(readings[key])), text);
}

function keyOf(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function fits(name: string, said: string): boolean {
  return LATIN.test(name) && !CYRILLIC.test(name) && CYRILLIC.test(said) && !LATIN.test(said);
}

function wordOf(key: string): RegExp {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu');
}

function titled(said: string): string {
  return said.replace(/(^|[\s-])(\p{Ll})/gu, (_, gap: string, c: string) => gap + c.toUpperCase());
}
