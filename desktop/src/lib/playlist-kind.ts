import type { Playlist } from './hooks';

export type ReleaseKind = 'album' | 'ep' | 'single' | 'compilation';

type KindSource = Pick<Playlist, 'kind' | 'playlist_type'> & { set_type?: string };

function releaseKindOfValue(value: string | undefined | null): ReleaseKind | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'album' || normalized === 'compilation' || normalized === 'single') {
    return normalized;
  }
  if (normalized === 'ep' || normalized === 'ep single') return 'ep';
  return null;
}

export function releaseKindOf(playlist: KindSource): ReleaseKind | null {
  return (
    releaseKindOfValue(playlist.kind) ??
    releaseKindOfValue(playlist.set_type) ??
    releaseKindOfValue(playlist.playlist_type)
  );
}

export function splitReleases<T extends KindSource>(items: T[]): { sets: T[]; releases: T[] } {
  const sets: T[] = [];
  const releases: T[] = [];
  for (const item of items) {
    (releaseKindOf(item) ? releases : sets).push(item);
  }
  return { sets, releases };
}
