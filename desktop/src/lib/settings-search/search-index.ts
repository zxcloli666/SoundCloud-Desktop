import { swapLayout } from './layout.ts';
import { tokenize } from './normalize.ts';
import { similarity } from './similarity.ts';
import type { FieldKind, SearchDoc, SearchHit } from './types.ts';

const FIELD_WEIGHT: Record<FieldKind, number> = {
  title: 1,
  phrase: 0.9,
  option: 0.6,
  desc: 0.5,
  context: 0.25,
};
const LAYOUT_PENALTY = 0.9;
const FIELD_BONUS = 0.5;
const PRECISION_FLOOR = 0.6;
const MIN_MATCHED_MASS = 0.3;
const CUT_BELOW_TOP = 0.3;
const UNKNOWN_WORD_WEIGHT = 0.15;
const STRONG_MATCH = 0.75;

interface Posting {
  doc: number;
  field: number;
}

interface Scored {
  doc: number;
  field: number;
  score: number;
}

export interface SearchIndex {
  docs: SearchDoc[];
  fieldLengths: number[][];
  postings: Map<string, Posting[]>;
  idf: Map<string, number>;
  unknownIdf: number;
}

export function buildSearchIndex(docs: SearchDoc[]): SearchIndex {
  const postings = new Map<string, Posting[]>();
  const docFrequency = new Map<string, number>();

  const fieldLengths: number[][] = [];

  docs.forEach((doc, docIndex) => {
    const inDoc = new Set<string>();
    fieldLengths.push([]);
    doc.fields.forEach((field, fieldIndex) => {
      const tokens = tokenize(field.text);
      fieldLengths[docIndex].push(tokens.length);
      for (const token of new Set(tokens)) {
        const list = postings.get(token) ?? [];
        list.push({ doc: docIndex, field: fieldIndex });
        postings.set(token, list);
        inDoc.add(token);
      }
    });
    for (const token of inDoc) docFrequency.set(token, (docFrequency.get(token) ?? 0) + 1);
  });

  const idf = new Map<string, number>();
  for (const [token, count] of docFrequency) idf.set(token, rarity(docs.length, count));
  return {
    docs,
    fieldLengths,
    postings,
    idf,
    unknownIdf: rarity(docs.length, 0) * UNKNOWN_WORD_WEIGHT,
  };
}

export function search(index: SearchIndex, query: string, limit = 20): SearchHit[] {
  const variants = [{ text: query, penalty: 1 }];
  const swapped = swapLayout(query);
  if (swapped !== query.toLowerCase()) variants.push({ text: swapped, penalty: LAYOUT_PENALTY });

  const results = variants.map((variant) => ({
    penalty: variant.penalty,
    ...scoreDocs(index, tokenize(variant.text)),
  }));
  const mostKnown = Math.max(...results.map((result) => result.known));

  const best = new Map<number, Scored>();
  for (const result of results) {
    if (result.known < mostKnown) continue;
    for (const scored of result.scored) {
      const score = scored.score * result.penalty;
      if (score > (best.get(scored.doc)?.score ?? 0)) best.set(scored.doc, { ...scored, score });
    }
  }

  const ranked = [...best.values()].sort((a, b) => b.score - a.score);
  if (ranked.length === 0) return [];
  const floor = ranked[0].score * CUT_BELOW_TOP;
  return ranked
    .filter((item) => item.score >= floor)
    .slice(0, limit)
    .map((item) => {
      const doc = index.docs[item.doc];
      const field = doc.fields[item.field];
      return { id: doc.id, score: item.score, kind: field.kind, text: field.text };
    });
}

function scoreDocs(index: SearchIndex, tokens: string[]): { known: number; scored: Scored[] } {
  if (tokens.length === 0) return { known: 0, scored: [] };
  const matches = tokens.map((token) => matchWords(index, token));
  const known = matches.filter((match) => match.bestSim >= STRONG_MATCH).length / tokens.length;
  const total = matches.reduce((sum, match) => sum + match.idf, 0);

  const perDoc = new Map<number, Map<number, number[]>>();
  matches.forEach((match, tokenIndex) => {
    for (const { word, sim } of match.words) {
      for (const posting of index.postings.get(word) ?? []) {
        const fields = perDoc.get(posting.doc) ?? new Map<number, number[]>();
        const sims = fields.get(posting.field) ?? new Array<number>(tokens.length).fill(0);
        sims[tokenIndex] = Math.max(sims[tokenIndex], sim);
        fields.set(posting.field, sims);
        perDoc.set(posting.doc, fields);
      }
    }
  });

  const scored: Scored[] = [];
  for (const [doc, fields] of perDoc) {
    const kinds = index.docs[doc].fields;
    let base = 0;
    let matchedMass = 0;
    tokens.forEach((_, tokenIndex) => {
      let weighted = 0;
      let solid = 0;
      for (const [field, sims] of fields) {
        const kind = kinds[field].kind;
        weighted = Math.max(weighted, sims[tokenIndex] * FIELD_WEIGHT[kind]);
        if (kind !== 'context') solid = Math.max(solid, sims[tokenIndex]);
      }
      base += matches[tokenIndex].idf * weighted;
      if (solid > 0) matchedMass += matches[tokenIndex].idf;
    });
    if (matchedMass < total * MIN_MATCHED_MASS) continue;

    let bestCoverage = 0;
    let bestField = -1;
    let bestContribution = 0;
    for (const [field, sims] of fields) {
      const kind = kinds[field].kind;
      if (kind === 'context') continue;
      const covered = sims.reduce((sum, sim, i) => sum + matches[i].idf * sim, 0);
      const contribution = covered * FIELD_WEIGHT[kind];
      if (contribution > bestContribution) {
        bestContribution = contribution;
        bestField = field;
      }
      const matchedTokens = sims.filter((sim) => sim > 0).length;
      const precision = Math.min(1, matchedTokens / index.fieldLengths[doc][field]);
      const sharpness = PRECISION_FLOOR + (1 - PRECISION_FLOOR) * precision;
      bestCoverage = Math.max(bestCoverage, (covered / total) * FIELD_WEIGHT[kind] * sharpness);
    }
    scored.push({ doc, field: bestField, score: base / total + FIELD_BONUS * bestCoverage });
  }
  return { known, scored };
}

function matchWords(index: SearchIndex, token: string) {
  const words: { word: string; sim: number }[] = [];
  let bestSim = 0;
  let idf = index.unknownIdf;
  for (const word of index.postings.keys()) {
    const sim = similarity(token, word);
    if (sim === 0) continue;
    words.push({ word, sim });
    if (sim > bestSim) {
      bestSim = sim;
      idf = index.idf.get(word) ?? idf;
    }
  }
  return { words, idf, bestSim };
}

function rarity(docCount: number, withToken: number): number {
  return Math.log(1 + (docCount - withToken + 0.5) / (withToken + 0.5));
}
