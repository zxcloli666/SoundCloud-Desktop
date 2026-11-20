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

export interface LyricLine {
  time: number;
  text: string;
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
  plainText: string | null;
  source: LyricsSource;
  language: string | null;
  languageConfidence: number | null;
  status: LyricsStatus;
  own?: boolean;
  lrclibId?: number;
}

const LRC_TIME_TAG = /^\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/;
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
    const text = rest.trim();
    for (const time of times) lines.push({ time: Math.max(0, time - offset), text });
  }
  return lines.sort((a, b) => a.time - b.time);
}

export function toResult(
  data: BackendLyricsResponse | null,
  unsynced = false,
): LyricsResult | null {
  if (!data) return null;
  const synced = data.syncedLrc ? parseLRC(data.syncedLrc) : [];
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
