//! Чистые хелперы офлайн-библиотеки: сборка строк, сортировка, фильтр,
//! зеркало односторонней duration-проверки Rust (короче заявленного = обрезок).

import type {CacheInventoryEntry} from '../../lib/cache';
import {idOf} from '../../lib/ids';
import type {Track} from '../../stores/player';
import type {OfflineEntry, SortMode} from './types';

const DURATION_TOLERANCE_MS = 4000;
const DURATION_TOLERANCE_FRAC = 0.04;

export function isTruncated(inv: CacheInventoryEntry | null): boolean {
  if (!inv?.durationMs || !inv.expectedDurationMs) return false;
  const tol = Math.max(DURATION_TOLERANCE_MS, inv.expectedDurationMs * DURATION_TOLERANCE_FRAC);
  return inv.durationMs + tol < inv.expectedDurationMs;
}

/** Реальная длительность файла, если измерена; иначе заявленная API. */
export function effectiveDurationMs(entry: OfflineEntry): number {
  return entry.inv?.durationMs ?? entry.track.duration ?? 0;
}

/** Минимальный Track для файла, которого нет в офлайн-индексе — файл должен
 *  быть виден и играбелен, а не молча выпадать из списка. */
export function stubTrack(inv: CacheInventoryEntry): Track {
  return {
    id: 0,
    urn: inv.urn,
    title: idOf(inv.urn) ?? inv.urn,
    duration: inv.durationMs ?? 0,
    artwork_url: null,
    user: { id: 0, urn: '', username: '', avatar_url: '' },
  };
}

export function buildLikesEntries(
  likedTracks: Track[],
  invByUrn: Map<string, CacheInventoryEntry>,
): OfflineEntry[] {
  return likedTracks.map((track) => ({
    urn: track.urn,
    track,
    inv: invByUrn.get(track.urn) ?? null,
  }));
}

export function buildCachedEntries(
  inventory: CacheInventoryEntry[],
  trackByUrn: Map<string, Track>,
): OfflineEntry[] {
  return inventory.map((inv) => {
    const track = trackByUrn.get(inv.urn);
    return track
      ? { urn: inv.urn, track, inv }
      : { urn: inv.urn, track: stubTrack(inv), inv, stub: true };
  });
}

export function filterEntries(entries: OfflineEntry[], query: string): OfflineEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (e) =>
      e.track.title.toLowerCase().includes(q) || e.track.user.username.toLowerCase().includes(q),
  );
}

const recentKey = (e: OfflineEntry) => e.inv?.modifiedAt ?? 0;

/** `customOrder === null` в режиме custom — входной порядок уже канонический
 *  (лайки идут в порядке лайканья). Неизвестные custom-порядку треки уходят в
 *  конец списка, свежие выше. */
export function sortEntries(
  entries: OfflineEntry[],
  mode: SortMode,
  customOrder: string[] | null,
): OfflineEntry[] {
  if (mode === 'custom') {
    if (!customOrder) return entries;
    const idx = new Map(customOrder.map((urn, i) => [urn, i]));
    return [...entries].sort((a, b) => {
      const ai = idx.get(a.urn);
      const bi = idx.get(b.urn);
      if (ai !== undefined && bi !== undefined) return ai - bi;
      if (ai !== undefined) return -1;
      if (bi !== undefined) return 1;
      return recentKey(b) - recentKey(a);
    });
  }

  const cmp: Record<Exclude<SortMode, 'custom'>, (a: OfflineEntry, b: OfflineEntry) => number> = {
    recent: (a, b) => recentKey(b) - recentKey(a),
    title: (a, b) => a.track.title.localeCompare(b.track.title),
    artist: (a, b) =>
      a.track.user.username.localeCompare(b.track.user.username) ||
      a.track.title.localeCompare(b.track.title),
    duration: (a, b) => effectiveDurationMs(b) - effectiveDurationMs(a),
    size: (a, b) => (b.inv?.bytes ?? 0) - (a.inv?.bytes ?? 0),
  };
  return [...entries].sort(cmp[mode]);
}
