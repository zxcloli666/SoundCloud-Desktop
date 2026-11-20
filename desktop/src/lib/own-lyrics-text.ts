import type { OwnLyricsInput } from './lyrics';

export const OWN_LYRICS_MAX_BYTES = 64 * 1024;

const TIME_TAG = /^\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/;
const META_TAG = /^\[[A-Za-z#]+:.*\]$/;

export type OwnLyricsKind = 'empty' | 'plain' | 'synced';

export interface OwnLyricsCheck {
  kind: OwnLyricsKind;
  lines: number;
  badLine: number | null;
  silent: boolean;
  tooLong: boolean;
}

function afterTimeTags(line: string): string | null {
  let match = line.match(TIME_TAG);
  if (!match) return null;
  let rest = line;
  while (match) {
    rest = rest.slice(match[0].length).trimStart();
    match = rest.match(TIME_TAG);
  }
  return rest;
}

export function normalizeOwnLyrics(text: string): string {
  return text.replace(/\r\n?/g, '\n').trim();
}

function leadingLines(raw: string): number {
  return raw.replace(/\r\n?/g, '\n').match(/^\s*/)?.[0].split('\n').length ?? 1;
}

export function checkOwnLyrics(raw: string): OwnLyricsCheck {
  const text = normalizeOwnLyrics(raw);
  const tooLong = new TextEncoder().encode(text).length > OWN_LYRICS_MAX_BYTES;
  if (!text) return { kind: 'empty', lines: 0, badLine: null, silent: false, tooLong: false };
  const rows = text.split('\n').map((line) => line.trim());
  const words = rows.filter((line) => line && !META_TAG.test(line)).length;
  const timed = rows.some((line) => afterTimeTags(line) !== null);
  if (!timed) return { kind: 'plain', lines: words, badLine: null, silent: false, tooLong };
  const bad = rows.findIndex(
    (line) => line && !META_TAG.test(line) && afterTimeTags(line) === null,
  );
  const sung = rows.some((line) => (afterTimeTags(line) ?? '').trim() !== '');
  return {
    kind: 'synced',
    lines: words,
    badLine: bad >= 0 ? bad + leadingLines(raw) : null,
    silent: !sung,
    tooLong,
  };
}

export function canSaveOwnLyrics(check: OwnLyricsCheck): boolean {
  return check.kind !== 'empty' && check.badLine === null && !check.silent && !check.tooLong;
}

export function ownLyricsInput(raw: string, check: OwnLyricsCheck): OwnLyricsInput {
  const text = normalizeOwnLyrics(raw);
  return check.kind === 'synced' ? { syncedLrc: text } : { plainText: text };
}

export function lyricsPreview(lrc: string | null, plain: string | null, count: number): string[] {
  const source = lrc
    ? lrc.split('\n').map((line) => afterTimeTags(line.trim()) ?? '')
    : (plain ?? '').split('\n');
  return source
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, count);
}

export function formatTrackLength(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '';
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
