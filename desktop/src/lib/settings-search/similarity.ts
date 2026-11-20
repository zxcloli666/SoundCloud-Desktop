const MIN_PREFIX = 3;
const MIN_COVERED = 0.6;
const DENSE_SCRIPT = /[ᄀ-ᇿ぀-ヿ一-鿿가-힯]/;

export function similarity(query: string, word: string): number {
  if (query === word) return 1;
  if (query.charCodeAt(0) === word.charCodeAt(0)) {
    if (query.length >= MIN_PREFIX && word.startsWith(query))
      return 0.85 + 0.1 * (query.length / word.length);

    const shared = commonPrefix(query, word);
    const shortest = Math.min(query.length, word.length);
    const covered = shared / Math.max(query.length, word.length);
    if (shared >= 2 && shared / shortest >= 0.75 && covered >= MIN_COVERED) {
      const minShared = DENSE_SCRIPT.test(query) ? 2 : 4;
      if (shared >= minShared) return 0.5 + 0.3 * covered;
    }
  }
  return typo(query, word);
}

function typo(query: string, word: string): number {
  const allowed = query.length >= 8 ? 2 : query.length >= 4 ? 1 : 0;
  if (allowed === 0 || Math.abs(query.length - word.length) > allowed) return 0;
  const distance = editDistance(query, word, allowed);
  return distance <= allowed ? 0.6 - 0.05 * (distance - 1) : 0;
}

function commonPrefix(a: string, b: string): number {
  let length = 0;
  while (length < a.length && length < b.length && a[length] === b[length]) length++;
  return length;
}

let older = new Int32Array(64);
let previous = new Int32Array(64);
let current = new Int32Array(64);

function editDistance(a: string, b: string, limit: number): number {
  const width = b.length + 1;
  if (width > previous.length) {
    older = new Int32Array(width);
    previous = new Int32Array(width);
    current = new Int32Array(width);
  }
  for (let j = 0; j < width; j++) previous[j] = j;

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    let best = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j < width; j++) {
      const bj = b.charCodeAt(j - 1);
      let value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (ai === bj ? 0 : 1),
      );
      if (i > 1 && j > 1 && ai === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === bj) {
        value = Math.min(value, older[j - 2] + 1);
      }
      current[j] = value;
      if (value < best) best = value;
    }
    if (best > limit) return limit + 1;
    const spare = older;
    older = previous;
    previous = current;
    current = spare;
  }
  return previous[width - 1];
}
