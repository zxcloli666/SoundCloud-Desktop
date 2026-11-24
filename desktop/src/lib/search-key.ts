const MARKS = /\p{M}/gu;
const SPACES = /\s+/g;

export function searchKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/ı/g, 'i')
    .normalize('NFKD')
    .replace(MARKS, '')
    .replace(SPACES, ' ')
    .trim();
}

export function queryTerms(query: string): string[] {
  const key = searchKey(query);
  return key ? key.split(' ') : [];
}

export function matchesTerms(terms: string[], ...fields: (string | null | undefined)[]): boolean {
  if (terms.length === 0) return true;
  const haystack = searchKey(fields.filter(Boolean).join(' '));
  return terms.every((term) => haystack.includes(term));
}
