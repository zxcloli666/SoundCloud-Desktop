import type { Track } from '../stores/player';

export const RELEASE_DAYS = 14;
const DAY_MS = 86_400_000;
const NAMES_SHOWN = 3;

export interface Release {
  track: Track;
  at: number;
}

export interface Announcement {
  count: number;
  artists: string[];
  more: boolean;
}

export function recentOriginals(releases: Release[], now: number): Release[] {
  const from = now - RELEASE_DAYS * DAY_MS;
  const urns = new Set<string>();
  const kept: Release[] = [];
  for (const release of releases) {
    const { urn, sharing } = release.track;
    if (urns.has(urn) || sharing === 'private') continue;
    if (release.at < from || release.at > now + DAY_MS) continue;
    urns.add(urn);
    kept.push(release);
  }
  return kept.sort((a, b) => b.at - a.at);
}

export function unseen(releases: Release[], seen: ReadonlySet<string>): Release[] {
  return releases.filter((release) => !seen.has(release.track.urn));
}

export function announcement(fresh: Release[]): Announcement {
  const names = new Set<string>();
  for (const { track } of fresh) names.add(track.user.username);
  const all = [...names];
  return {
    count: fresh.length,
    artists: all.slice(0, NAMES_SHOWN),
    more: all.length > NAMES_SHOWN,
  };
}
