import { pendingOwnLyrics } from '../stores/own-lyrics';
import { ApiError, api } from './api';

export type LyricsSource =
  | 'lrclib'
  | 'musixmatch'
  | 'genius'
  | 'netease'
  | 'self_gen'
  | 'user'
  | 'none';

export type LyricsStatus = 'found' | 'pending' | 'none';

export interface LyricWord {
  time: number;
  at: number;
}

export interface LyricLine {
  time: number;
  text: string;
  words?: LyricWord[];
  end?: number;
}

export interface LyricsResult {
  status: LyricsStatus;
  plain: string | null;
  synced: LyricLine[] | null;
  lrc: string | null;
  source: LyricsSource;
  language: string | null;
  own: boolean;
  lrclibId: number | null;
  unsynced: boolean;
}

export interface OwnLyricsInput {
  plainText?: string;
  syncedLrc?: string;
  lrclibId?: number;
}

export interface BackendLyricsResponse {
  scTrackId: string;
  syncedLrc: string | null;
  syncedWords?: string | null;
  plainText: string | null;
  source: LyricsSource;
  language: string | null;
  languageConfidence: number | null;
  status: LyricsStatus;
  own?: boolean;
  lrclibId?: number;
}

const LRC_TIME_TAG = /^\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/;
const LRC_WORD_TAG = /<(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?>/g;
const LRC_OFFSET_TAG = /^\s*\[offset:\s*([+-]?\d+)\s*\]/im;

export function parseLRC(lrc: string): LyricLine[] {
  const offset = Number(lrc.match(LRC_OFFSET_TAG)?.[1] ?? 0) / 1000;
  const lines: LyricLine[] = [];
  for (const raw of lrc.split('\n')) {
    let rest = raw.trim();
    const times: number[] = [];
    let m = rest.match(LRC_TIME_TAG);
    while (m) {
      times.push(+m[1] * 60 + +m[2] + +(m[3] ?? '0').padEnd(3, '0') / 1000);
      rest = rest.slice(m[0].length).trimStart();
      m = rest.match(LRC_TIME_TAG);
    }
    const { text, words, end } = parseWordTags(rest, offset);
    const single = times.length === 1;
    for (const time of times) {
      const line: LyricLine = { time: Math.max(0, time - offset), text };
      if (single && words) Object.assign(line, { words, end });
      lines.push(line);
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

function parseWordTags(
  rest: string,
  offset: number,
): { text: string; words?: LyricWord[]; end?: number } {
  const stamps: LyricWord[] = [];
  let plain = '';
  let last = 0;
  for (const m of rest.matchAll(LRC_WORD_TAG)) {
    plain += rest.slice(last, m.index);
    last = m.index + m[0].length;
    const time = +m[1] * 60 + +m[2] + +(m[3] ?? '0').padEnd(3, '0') / 1000;
    stamps.push({ time: Math.max(0, time - offset), at: plain.length });
  }
  plain += rest.slice(last);
  const text = plain.trim();
  if (stamps.length < 2) return { text };
  const lead = plain.length - plain.trimStart().length;
  for (const stamp of stamps) stamp.at = Math.max(0, stamp.at - lead);
  const end = stamps[stamps.length - 1];
  const words = stamps.slice(0, -1);
  if (end.at < text.length || !isWordSequence(stamps, text.length)) return { text };
  return { text, words, end: end.time };
}

function isWordSequence(stamps: LyricWord[], length: number): boolean {
  return stamps.every(
    (stamp, i) =>
      stamp.at <= length &&
      (i === 0 || (stamp.time >= stamps[i - 1].time && stamp.at > stamps[i - 1].at)),
  );
}

export function toResult(
  data: BackendLyricsResponse | null,
  unsynced = false,
): LyricsResult | null {
  if (!data) return null;
  const withWords = data.syncedWords ? parseLRC(data.syncedWords) : [];
  const synced = withWords.some((line) => line.text)
    ? withWords
    : data.syncedLrc
      ? parseLRC(data.syncedLrc)
      : [];
  return {
    status: data.status,
    plain: data.plainText,
    synced: synced.some((line) => line.text) ? synced : null,
    lrc: data.syncedLrc,
    source: data.source,
    language: data.language,
    own: data.own === true,
    lrclibId: data.lrclibId ?? null,
    unsynced,
  };
}

export function localOwnResult(
  scTrackId: string,
  input: OwnLyricsInput,
  unsynced = true,
): LyricsResult | null {
  return toResult(
    {
      scTrackId,
      syncedLrc: input.syncedLrc ?? null,
      plainText: input.plainText ?? null,
      source: input.lrclibId ? 'lrclib' : 'user',
      language: null,
      languageConfidence: null,
      status: 'found',
      own: true,
      lrclibId: input.lrclibId,
    },
    unsynced,
  );
}

export async function getLyricsByTrack(scTrackId: string): Promise<LyricsResult | null> {
  const waiting = pendingOwnLyrics(scTrackId);
  if (waiting) return localOwnResult(scTrackId, waiting.input);
  const data = await api<BackendLyricsResponse>(`/lyrics/${encodeURIComponent(scTrackId)}`, {
    silentStatuses: [404],
  }).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  return toResult(data);
}
