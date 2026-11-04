import type { Millis } from './types';

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;
export const GROUP_GAP_MS = 5 * MINUTE_MS;

const formats = new Map<string, Intl.DateTimeFormat>();
const units = new Map<string, Intl.NumberFormat>();

function dateFormat(language: string, key: string, options: Intl.DateTimeFormatOptions) {
  const id = `${language}:${key}`;
  let cached = formats.get(id);
  if (!cached) {
    cached = new Intl.DateTimeFormat(language, options);
    formats.set(id, cached);
  }
  return cached;
}

function unitFormat(language: string, unit: string) {
  const id = `${language}:${unit}`;
  let cached = units.get(id);
  if (!cached) {
    cached = new Intl.NumberFormat(language, { style: 'unit', unit, unitDisplay: 'narrow' });
    units.set(id, cached);
  }
  return cached;
}

export function clockTime(ts: Millis, language: string): string {
  return dateFormat(language, 'clock', { hour: '2-digit', minute: '2-digit' }).format(ts);
}

export function fullTime(ts: Millis, language: string): string {
  return dateFormat(language, 'full', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ts);
}

export function dayKey(ts: Millis): string {
  const date = new Date(ts);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function sameDay(a: Millis, b: Millis): boolean {
  return dayKey(a) === dayKey(b);
}

export type DayLabel = { kind: 'today' } | { kind: 'yesterday' } | { kind: 'date'; text: string };

export function dayLabel(ts: Millis, now: Millis, language: string): DayLabel {
  if (sameDay(ts, now)) return { kind: 'today' };
  if (sameDay(ts, now - DAY_MS)) return { kind: 'yesterday' };
  const thisYear = new Date(ts).getFullYear() === new Date(now).getFullYear();
  const options: Intl.DateTimeFormatOptions = thisYear
    ? { day: 'numeric', month: 'long', weekday: 'short' }
    : { day: 'numeric', month: 'long', year: 'numeric' };
  return {
    kind: 'date',
    text: dateFormat(language, thisYear ? 'day' : 'year', options).format(ts),
  };
}

export function shortDate(ts: Millis, now: Millis, language: string): string {
  if (sameDay(ts, now)) return clockTime(ts, language);
  const thisYear = new Date(ts).getFullYear() === new Date(now).getFullYear();
  const options: Intl.DateTimeFormatOptions = thisYear
    ? { day: 'numeric', month: 'short' }
    : { day: '2-digit', month: '2-digit', year: '2-digit' };
  return dateFormat(language, thisYear ? 'short' : 'numeric', options).format(ts);
}

export function timeLeft(expiresAt: Millis, now: Millis, language: string): string {
  const left = Math.max(0, expiresAt - now);
  if (left >= DAY_MS) return unitFormat(language, 'day').format(Math.ceil(left / DAY_MS));
  if (left >= HOUR_MS) return unitFormat(language, 'hour').format(Math.ceil(left / HOUR_MS));
  return unitFormat(language, 'minute').format(Math.max(1, Math.ceil(left / MINUTE_MS)));
}

export function lifeLeft(sentAt: Millis, expiresAt: Millis, now: Millis): number {
  const span = expiresAt - sentAt;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (expiresAt - now) / span));
}
