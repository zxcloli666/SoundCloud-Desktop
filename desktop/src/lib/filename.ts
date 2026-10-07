const MAX_NAME_LENGTH = 120;
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;

export function sanitizeFilename(name: string): string {
  const cleaned = Array.from(name.replace(/[<>:"/\\|?*]/g, '_'))
    .map((ch) => (ch.charCodeAt(0) < 32 ? '_' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  const clipped = Array.from(cleaned).slice(0, MAX_NAME_LENGTH).join('');
  const tidy = clipped.replace(/[. ]+$/, '');
  if (!tidy) return '_';
  return RESERVED.test(tidy) ? `_${tidy}` : tidy;
}

export function uniqueFileNames(stems: string[], extension: string): string[] {
  const taken = new Map<string, number>();
  return stems.map((raw) => {
    const stem = sanitizeFilename(raw);
    const key = stem.toLowerCase();
    const seen = taken.get(key) ?? 0;
    taken.set(key, seen + 1);
    return seen === 0 ? `${stem}.${extension}` : `${stem} (${seen + 1}).${extension}`;
  });
}
