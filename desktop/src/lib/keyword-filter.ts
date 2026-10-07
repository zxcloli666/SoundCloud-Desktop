import type { Track } from '../stores/player';
import { useSettingsStore } from '../stores/settings';

const NON_WORD = /[^\p{L}\p{N}]+/gu;

export function normalizeKeyword(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(NON_WORD, ' ').trim();
}

let compiledSource: string[] | null = null;
let compiled: string[] = [];

function compile(keywords: string[]): string[] {
  if (keywords !== compiledSource) {
    compiledSource = keywords;
    compiled = [...new Set(keywords.map(normalizeKeyword).filter(Boolean))].map((k) => ` ${k} `);
  }
  return compiled;
}

const haystacks = new WeakMap<Track, string>();

function trackHaystack(track: Track): string {
  const cached = haystacks.get(track);
  if (cached !== undefined) return cached;
  const enrichment = track.enrichment;
  const parts = [
    track.title,
    track.genre,
    track.tag_list,
    track.user?.username,
    enrichment?.primary_artist?.name,
    ...(enrichment?.participants?.map((p) => p.artist.name) ?? []),
  ];
  const haystack = ` ${normalizeKeyword(parts.filter(Boolean).join(' '))} `;
  haystacks.set(track, haystack);
  return haystack;
}

export function keywordMatcher(keywords: string[]): (track: Track) => boolean {
  const needles = compile(keywords);
  if (needles.length === 0) return () => false;
  return (track) => {
    const haystack = trackHaystack(track);
    return needles.some((k) => haystack.includes(k));
  };
}

export function useBlockedKeywords(): string[] {
  return useSettingsStore((s) => s.blockedKeywords);
}
