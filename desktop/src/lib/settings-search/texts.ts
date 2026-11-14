export function lookupText(lookup: (key: string) => unknown, key: string): string {
  for (const name of [key, `${key}_other`]) {
    const value = lookup(name);
    if (typeof value === 'string') return value;
  }
  return '';
}

export function plainText(text: string): string {
  return text
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
