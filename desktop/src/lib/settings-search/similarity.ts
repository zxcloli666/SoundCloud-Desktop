const MIN_PREFIX = 3;
const MIN_COVERED = 0.6;
const DENSE_SCRIPT = /[ᄀ-ᇿ぀-ヿ一-鿿가-힯]/;

export function similarity(query: string, word: string): number {
  if (query === word) return 1;
  if (query.length >= MIN_PREFIX && word.startsWith(query))
    return 0.85 + 0.1 * (query.length / word.length);

  const shared = commonPrefix(query, word);
  const shortest = Math.min(query.length, word.length);
  const longest = Math.max(query.length, word.length);
  const minShared = DENSE_SCRIPT.test(query) ? 2 : 4;
  const covered = shared / longest;
  if (shared >= minShared && shared / shortest >= 0.75 && covered >= MIN_COVERED) {
    return 0.5 + 0.3 * covered;
  }

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

function editDistance(a: string, b: string, limit: number): number {
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    rows.push(new Array<number>(b.length + 1).fill(0));
    rows[i][0] = i;
  }
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    let best = Number.POSITIVE_INFINITY;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, rows[i - 2][j - 2] + 1);
      }
      rows[i][j] = value;
      best = Math.min(best, value);
    }
    if (best > limit) return limit + 1;
  }
  return rows[a.length][b.length];
}
