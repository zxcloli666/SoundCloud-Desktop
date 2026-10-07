import type { Track } from '../stores/player';

export type ArrangeMode = 'reverse' | 'title' | 'artist' | 'duration';

export const ARRANGE_MODES: ArrangeMode[] = ['reverse', 'title', 'artist', 'duration'];

export function arrangeTracks(tracks: Track[], mode: ArrangeMode, locale: string): Track[] {
  if (mode === 'reverse') return [...tracks].reverse();
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  const byTitle = (a: Track, b: Track) => collator.compare(a.title, b.title);
  const compare = {
    title: byTitle,
    artist: (a: Track, b: Track) =>
      collator.compare(a.user.username, b.user.username) || byTitle(a, b),
    duration: (a: Track, b: Track) => a.duration - b.duration || byTitle(a, b),
  }[mode];
  return [...tracks].sort(compare);
}
