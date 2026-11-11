import type { SearchDoc, SearchField, SettingsEntry } from './types.ts';

export function buildDocs(
  entries: SettingsEntry[],
  texts: (key: string) => string[],
  phrases: Record<string, string[]>[],
  categoryLabel: (category: string) => string[],
): SearchDoc[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const keyTexts = (keys: string[]) => keys.flatMap((key) => texts(key));

  return entries.map((entry) => {
    const host = entry.kind === 'row' ? byId.get(entry.card) : undefined;
    const fields: SearchField[] = [
      ...keyTexts(entry.title).map((text) => ({ kind: 'title' as const, text })),
      ...phrases
        .flatMap((file) => file[entry.id] ?? [])
        .map((text) => ({ kind: 'phrase' as const, text })),
      ...keyTexts(entry.keys).map((text) => ({ kind: 'option' as const, text })),
      ...keyTexts(entry.desc).map((text) => ({ kind: 'desc' as const, text })),
      ...keyTexts(host?.title ?? []).map((text) => ({ kind: 'context' as const, text })),
      ...categoryLabel(entry.category).map((text) => ({ kind: 'context' as const, text })),
    ];
    return { id: entry.id, fields: clean(fields) };
  });
}

function clean(fields: SearchField[]): SearchField[] {
  const seen = new Set<string>();
  const result: SearchField[] = [];
  for (const field of fields) {
    const text = field.text
      .replace(/\{\{[^}]*\}\}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const id = `${field.kind}:${text}`;
    if (text === '' || seen.has(id)) continue;
    seen.add(id);
    result.push({ kind: field.kind, text });
  }
  return result;
}
