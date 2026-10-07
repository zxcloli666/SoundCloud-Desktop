import type { LocalTrack } from '../../../lib/local-library';
import { localArtist, localTrackToTrack } from '../../../lib/local-library';
import type { Track } from '../../../stores/player';
import type { SortMode } from '../types';

export interface LocalRow {
  id: string;
  urn: string;
  info: LocalTrack;
  track: Track;
  missing: boolean;
}

const trackCache = new WeakMap<LocalTrack, Track>();

export function trackOf(info: LocalTrack): Track {
  let track = trackCache.get(info);
  if (!track) {
    track = localTrackToTrack(info);
    trackCache.set(info, track);
  }
  return track;
}

export function buildLocalRows(
  ids: string[],
  tracks: Record<string, LocalTrack>,
  missing: Record<string, true>,
): LocalRow[] {
  return ids.flatMap((id) => {
    const info = tracks[id];
    if (!info) return [];
    const track = trackOf(info);
    return [{ id, urn: track.urn, info, track, missing: missing[id] === true }];
  });
}

export function fileExtension(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot > 0 ? path.slice(dot + 1).toUpperCase() : '';
}

export function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function filterLocalRows(rows: LocalRow[], query: string): LocalRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(({ info }) =>
    [info.title, info.artist, info.album, info.albumArtist, fileName(info.path)].some((v) =>
      v?.toLowerCase().includes(q),
    ),
  );
}

export function sortLocalRows(rows: LocalRow[], mode: SortMode): LocalRow[] {
  if (mode === 'custom') return rows;
  const cmp: Record<Exclude<SortMode, 'custom'>, (a: LocalRow, b: LocalRow) => number> = {
    recent: (a, b) => b.info.addedAt - a.info.addedAt,
    title: (a, b) => a.info.title.localeCompare(b.info.title),
    artist: (a, b) =>
      localArtist(a.info).localeCompare(localArtist(b.info)) ||
      (a.info.album ?? '').localeCompare(b.info.album ?? '') ||
      (a.info.trackNumber ?? 0) - (b.info.trackNumber ?? 0) ||
      a.info.title.localeCompare(b.info.title),
    duration: (a, b) => (b.info.durationMs ?? 0) - (a.info.durationMs ?? 0),
    size: (a, b) => b.info.bytes - a.info.bytes,
  };
  return [...rows].sort(cmp[mode]);
}

export function folderLabel(folder: string): string {
  const parts = folder.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? folder;
}
