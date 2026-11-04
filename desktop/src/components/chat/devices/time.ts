import type { TFunction } from 'i18next';
import type { Millis } from '../../../lib/chat/types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

interface Part {
  unit: 'd' | 'h' | 'm';
  count: number;
}

function units(ms: number): Part[] {
  const left = Math.max(ms, MINUTE);
  const all: Part[] = [
    { unit: 'd', count: Math.floor(left / DAY) },
    { unit: 'h', count: Math.floor((left % DAY) / HOUR) },
    { unit: 'm', count: Math.max(1, Math.floor((left % HOUR) / MINUTE)) },
  ];
  const first = all.findIndex((part) => part.count > 0);
  return all.slice(first, first + 2).filter((part) => part.count > 0);
}

export function spanText(t: TFunction, ms: number): string {
  return units(ms)
    .map(({ unit, count }) => t(`chat.devices.span.${unit}`, { count }))
    .join(' ');
}

export function spanShort(t: TFunction, ms: number): string {
  const { unit, count } = units(ms)[0];
  return t(`chat.devices.span.${unit}`, { count });
}

const relative = new Map<string, Intl.RelativeTimeFormat>();

function rtf(locale: string): Intl.RelativeTimeFormat {
  let format = relative.get(locale);
  if (!format) {
    format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
    relative.set(locale, format);
  }
  return format;
}

export function seenText(t: TFunction, locale: string, at: Millis, now: Millis): string {
  const ago = now - at;
  if (ago < 2 * MINUTE) return t('chat.devices.seen.now');
  if (ago < HOUR) return rtf(locale).format(-Math.floor(ago / MINUTE), 'minute');
  if (ago < DAY) return rtf(locale).format(-Math.floor(ago / HOUR), 'hour');
  if (ago < 30 * DAY) return rtf(locale).format(-Math.floor(ago / DAY), 'day');
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(at);
}

export function addedText(locale: string, at: Millis, now: Millis): string {
  const ago = Math.max(0, now - at);
  if (ago < HOUR) return rtf(locale).format(-Math.floor(ago / MINUTE), 'minute');
  const clock = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(at);
  if (new Date(at).toDateString() === new Date(now).toDateString()) {
    return `${rtf(locale).format(0, 'day')}, ${clock}`;
  }
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(at);
}

export function exactText(locale: string, at: Millis): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(at);
}
