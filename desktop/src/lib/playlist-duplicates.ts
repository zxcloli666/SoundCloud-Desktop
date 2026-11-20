import type { Track } from '../stores/player';

const DURATION_TOLERANCE_MS = 3000;

export interface DuplicateCopy {
  index: number;
  track: Track;
  sameTrack: boolean;
}

export interface DuplicateGroup {
  keep: Track;
  copies: DuplicateCopy[];
}

function normalize(text: string) {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function titleKey(track: Track) {
  const title = normalize(track.title);
  return title && `${title}|${normalize(track.user.username)}`;
}

export function findDuplicates(tracks: Track[]): DuplicateGroup[] {
  const byUrn = new Map<string, DuplicateGroup>();
  const byTitle = new Map<string, DuplicateGroup[]>();
  const groups: DuplicateGroup[] = [];

  tracks.forEach((track, index) => {
    const same = byUrn.get(track.urn);
    if (same) {
      same.copies.push({ index, track, sameTrack: true });
      return;
    }
    const key = titleKey(track);
    const similar = byTitle
      .get(key)
      ?.find((g) => Math.abs(g.keep.duration - track.duration) <= DURATION_TOLERANCE_MS);
    if (similar) {
      similar.copies.push({ index, track, sameTrack: false });
      return;
    }
    const group = { keep: track, copies: [] };
    byUrn.set(track.urn, group);
    if (key) byTitle.set(key, [...(byTitle.get(key) ?? []), group]);
    groups.push(group);
  });

  return groups.filter((g) => g.copies.length > 0);
}
