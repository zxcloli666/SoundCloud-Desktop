import { swapLayout } from '../../../lib/settings-search/layout';
import { normalize, tokenize } from '../../../lib/settings-search/normalize';
import { similarity } from '../../../lib/settings-search/similarity';

export interface Piece {
  text: string;
  hit: boolean;
}

const WORD = /[\p{L}\p{N}]+/gu;
const MIN_SIMILARITY = 0.55;

export function splitMatches(text: string, query: string): Piece[] {
  const tokens = [...new Set([...tokenize(query), ...tokenize(swapLayout(query))])];
  const pieces: Piece[] = [];
  let last = 0;
  for (const match of text.matchAll(WORD)) {
    const word = normalize(match[0]);
    if (!tokens.some((token) => similarity(token, word) >= MIN_SIMILARITY)) continue;
    if (match.index > last) pieces.push({ text: text.slice(last, match.index), hit: false });
    pieces.push({ text: match[0], hit: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) pieces.push({ text: text.slice(last), hit: false });
  return pieces;
}
