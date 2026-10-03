import { isLiveTile } from '../../lib/search/live';
import type { Track } from '../../stores/player';
import { isHeroPos, isHeroUrn, type WallItem } from './utils';

export function toTiles(tracks: Track[], kind: WallItem['kind']): WallItem[] {
  return tracks.filter((t) => t?.urn).map((track, i) => ({ track, kind, hero: isHeroPos(i) }));
}

function tile(track: Track, kind: WallItem['kind'], matchedLine?: string | null): WallItem {
  return { track, kind, matchedLine, live: isLiveTile(track), hero: isHeroUrn(track.urn) };
}

export function weaveText(
  lex: Track[],
  lyric: { track: Track; matchedLine: string | null }[],
  vibe: Track[],
): WallItem[] {
  const out: WallItem[] = [];
  const seen = new Set<string>();
  let li = 0;
  let ly = 0;
  let vi = 0;
  let slot = 0;
  const push = (track: Track, kind: WallItem['kind'], matchedLine?: string | null): boolean => {
    if (!track?.urn || seen.has(track.urn)) return false;
    seen.add(track.urn);
    out.push(tile(track, kind, matchedLine));
    return true;
  };

  while (li < lex.length || ly < lyric.length || vi < vibe.length) {
    let placed = false;
    if (ly < lyric.length && slot % 4 === 2) {
      placed = push(lyric[ly].track, 'lyric', lyric[ly].matchedLine);
      ly++;
    } else if (vi < vibe.length && slot % 7 === 5) {
      placed = push(vibe[vi], 'vibe');
      vi++;
    } else if (li < lex.length) {
      placed = push(lex[li], 'lexical');
      li++;
    } else if (ly < lyric.length) {
      placed = push(lyric[ly].track, 'lyric', lyric[ly].matchedLine);
      ly++;
    } else if (vi < vibe.length) {
      placed = push(vibe[vi], 'vibe');
      vi++;
    }
    if (placed) slot++;
  }
  return out;
}

export function mergeLive(live: Track[], local: Track[]): WallItem[] {
  const seen = new Set<string>();
  const out: WallItem[] = [];
  for (const track of [...live, ...local]) {
    if (!track?.urn || seen.has(track.urn)) continue;
    seen.add(track.urn);
    out.push(tile(track, 'lexical'));
  }
  return out;
}

export function appendLiveOnly(items: WallItem[], live: Track[]): WallItem[] {
  const seen = new Set(items.map((item) => item.track.urn));
  const extra = live.filter((track) => track?.urn && isLiveTile(track) && !seen.has(track.urn));
  return extra.length ? [...items, ...extra.map((track) => tile(track, 'lexical'))] : items;
}
