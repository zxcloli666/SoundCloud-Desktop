import type { Track } from '../../../stores/player';
import type { ListeningStats, RhythmCell, TopTrack } from './useListeningStats';

export interface TimelineBar {
  key: string;
  date: Date;
  plays: number;
  listenedMs: number;
}

export type ListenerKind = 'night' | 'morning' | 'day' | 'evening';

export interface Rhythm {
  grid: number[][];
  hours: number[];
  weekdays: number[];
  max: number;
  total: number;
  peakHour: number;
  peakWeekday: number;
  kind: ListenerKind;
  kindShare: number;
}

const MONDAY = new Date(2024, 0, 1);

export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function dateKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function fillTimeline(stats: ListeningStats): TimelineBar[] {
  const byKey = new Map(stats.timeline.map((p) => [p.date, p]));
  const end = parseLocalDate(stats.to);
  const cursor = parseLocalDate(stats.from);
  const bars: TimelineBar[] = [];
  while (cursor <= end && bars.length < 400) {
    const key = dateKey(cursor);
    const point = byKey.get(key);
    bars.push({
      key,
      date: new Date(cursor),
      plays: point?.plays ?? 0,
      listenedMs: point?.listenedMs ?? 0,
    });
    if (stats.unit === 'day') cursor.setDate(cursor.getDate() + 1);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return bars;
}

export function deltaPercent(current: number, previous: number | undefined): number | null {
  if (previous == null || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function splitDuration(ms: number): { hours: number; minutes: number } {
  const totalMinutes = Math.round(ms / 60_000);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

function kindOfHour(hour: number): ListenerKind {
  if (hour < 5) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'day';
  return 'evening';
}

function argMax(values: number[]): number {
  return values.reduce((best, v, i) => (v > values[best] ? i : best), 0);
}

export function buildRhythm(cells: RhythmCell[]): Rhythm {
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const c of cells) {
    if (c.weekday >= 1 && c.weekday <= 7 && c.hour >= 0 && c.hour < 24) {
      grid[c.weekday - 1][c.hour] += c.plays;
    }
  }
  const hours = Array.from({ length: 24 }, (_, h) => grid.reduce((sum, row) => sum + row[h], 0));
  const weekdays = grid.map((row) => row.reduce((sum, v) => sum + v, 0));
  const total = weekdays.reduce((sum, v) => sum + v, 0);
  const byKind: Record<ListenerKind, number> = { night: 0, morning: 0, day: 0, evening: 0 };
  hours.forEach((v, h) => {
    byKind[kindOfHour(h)] += v;
  });
  const kind = (Object.keys(byKind) as ListenerKind[]).reduce((a, b) =>
    byKind[b] > byKind[a] ? b : a,
  );
  return {
    grid,
    hours,
    weekdays,
    max: Math.max(1, ...grid.flat()),
    total,
    peakHour: argMax(hours),
    peakWeekday: argMax(weekdays),
    kind,
    kindShare: total > 0 ? byKind[kind] / total : 0,
  };
}

export function weekdayNames(locale: string, style: 'short' | 'long'): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: style });
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(MONDAY);
    d.setDate(MONDAY.getDate() + i);
    return fmt.format(d);
  });
}

export function hourLabel(locale: string, hour: number): string {
  const d = new Date(MONDAY);
  d.setHours(hour, 0, 0, 0);
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(d);
}

export function topTrackToTrack(entry: TopTrack): Track {
  return {
    id: 0,
    urn: entry.trackUrn,
    title: entry.title,
    duration: entry.duration,
    artwork_url: entry.artworkUrl,
    user: {
      id: 0,
      urn: entry.artistUrn || '',
      username: entry.artistName,
      avatar_url: '',
      permalink_url: '',
    },
  };
}
