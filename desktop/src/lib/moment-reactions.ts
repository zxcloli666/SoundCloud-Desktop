import { useSyncExternalStore } from 'react';

export interface ValueCount {
  valueUrn: string;
  count: number;
}

export interface Moment {
  total: number;
  counts: ValueCount[];
  own: string | null;
  touchedAt: number;
}

export interface MomentReading {
  second: number;
  total: number;
  counts: ValueCount[];
  own: string | null;
}

export type Moments = ReadonlyMap<number, Moment>;

const FRESH_MS = 120_000;
const EMPTY: Moments = new Map();

const tracks = new Map<string, Moments>();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function put(trackUrn: string, second: number, moment: Moment | undefined) {
  const next = new Map(tracks.get(trackUrn) ?? EMPTY);
  if (moment) next.set(second, moment);
  else next.delete(second);
  tracks.set(trackUrn, next);
}

export function getMoment(trackUrn: string, second: number): Moment | undefined {
  return tracks.get(trackUrn)?.get(second);
}

export function useMoments(trackUrn: string): Moments {
  return useSyncExternalStore(subscribe, () => tracks.get(trackUrn) ?? EMPTY);
}

export function seedMoments(trackUrn: string, readings: MomentReading[], now = Date.now()) {
  for (const reading of readings) {
    const known = getMoment(trackUrn, reading.second);
    if (known && now - known.touchedAt < FRESH_MS) continue;
    const empty = reading.total === 0 && reading.own === null;
    put(
      trackUrn,
      reading.second,
      empty
        ? undefined
        : { total: reading.total, counts: reading.counts, own: reading.own, touchedAt: 0 },
    );
  }
  notify();
}

function counted(counts: ValueCount[], valueUrn: string, step: number): ValueCount[] {
  const found = counts.some((entry) => entry.valueUrn === valueUrn);
  const next = found
    ? counts.map((entry) =>
        entry.valueUrn === valueUrn ? { ...entry, count: entry.count + step } : entry,
      )
    : [...counts, { valueUrn, count: step }];
  return next
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.valueUrn.localeCompare(b.valueUrn));
}

export function setOwnReaction(
  trackUrn: string,
  second: number,
  valueUrn: string | null,
  now = Date.now(),
) {
  const known = getMoment(trackUrn, second);
  let counts = known?.counts ?? [];
  if (known?.own) counts = counted(counts, known.own, -1);
  if (valueUrn) counts = counted(counts, valueUrn, 1);
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);
  put(trackUrn, second, { total, counts, own: valueUrn, touchedAt: now });
  notify();
}

export function restoreMoment(trackUrn: string, second: number, moment: Moment | undefined) {
  put(trackUrn, second, moment);
  notify();
}

export function forgetMoments() {
  tracks.clear();
  notify();
}

export function emojiOf(valueUrn: string, known: { valueUrn: string; emoji: string }[]): string {
  const hit = known.find((value) => value.valueUrn === valueUrn);
  if (hit) return hit.emoji;
  const codes = valueUrn.split(':').pop()?.split('-') ?? [];
  const points = codes.map((code) => Number.parseInt(code, 16));
  if (points.length === 0 || points.some((point) => !Number.isFinite(point))) return '';
  try {
    return String.fromCodePoint(...points);
  } catch {
    return '';
  }
}
