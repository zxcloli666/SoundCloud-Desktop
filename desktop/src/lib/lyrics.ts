import { ApiError, api } from './api';
import { edgeFetch } from './edge';
import { RequestTimeoutError, withTimeout } from './request-timeout';
import {
  cacheLyrics,
  getCachedLyrics,
  searchLyricsCacheKey,
  trackLyricsCacheKey,
  transcriptionLyricsCacheKey,
} from './lyrics-cache';

export type LyricsSource = 'lrclib' | 'musixmatch' | 'genius' | 'netease' | 'self_gen' | 'none';

export interface LyricLine {
  time: number;
  text: string;
}

export interface LyricsResult {
  plain: string | null;
  synced: LyricLine[] | null;
  source: LyricsSource;
  language: string | null;
}

interface BackendLyricsResponse {
  scTrackId: string;
  syncedLrc: string | null;
  plainText: string | null;
  source: LyricsSource;
  language: string | null;
  languageConfidence: number | null;
}

interface LrcLibResponse {
  trackName?: string;
  artistName?: string;
  duration?: number;
  plainLyrics: string | null;
  syncedLyrics: string | null;
  instrumental: boolean;
}

export interface LyricsTrackLookup {
  scTrackId: string;
  artist: string;
  title: string;
  durationMs?: number;
}

const DIRECT_LYRICS_TIMEOUT_MS = 5_500;
const BACKEND_LYRICS_TIMEOUT_MS = 8_000;
const AUTO_LOOKUP_TIMEOUT_MS = 9_000;
const TRANSCRIPTION_TIMEOUT_MS = 45_000;
const LYRICS_BODY_TIMEOUT_MS = 4_000;
const BACKEND_SILENT_STATUSES = [404, 500, 501, 502, 503, 504];
const LRCLIB_HEADERS = { 'User-Agent': 'Sonveil (https://github.com/hexnow/Hellishfy)' };

/** Parse LRC format: [mm:ss.xx] text */
export function parseLRC(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of lrc.split('\n')) {
    const match = raw.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/);
    if (!match) continue;
    const time = +match[1] * 60 + +match[2] + +match[3].padEnd(3, '0') / 1000;
    const text = match[4].trim();
    if (text) lines.push({ time, text });
  }
  return lines;
}

function toResult(data: BackendLyricsResponse | null): LyricsResult | null {
  if (!data) return null;
  const synced = data.syncedLrc ? parseLRC(data.syncedLrc) : null;
  return {
    plain: data.plainText,
    synced: synced && synced.length > 0 ? synced : null,
    source: data.source,
    language: data.language,
  };
}

function toLrcLibResult(data: LrcLibResponse | null): LyricsResult | null {
  if (!data || data.instrumental) return null;
  const synced = data.syncedLyrics ? parseLRC(data.syncedLyrics) : null;
  const result: LyricsResult = {
    plain: data.plainLyrics,
    synced: synced && synced.length > 0 ? synced : null,
    source: 'lrclib',
    language: null,
  };
  return hasLyrics(result) ? result : null;
}

function hasLyrics(result: LyricsResult | null): result is LyricsResult {
  return !!(result?.plain?.trim() || (result?.synced && result.synced.length > 0));
}

function abortError(): DOMException {
  return new DOMException('Lyrics lookup canceled', 'AbortError');
}

async function firstAvailableLyrics(
  loaders: Array<(signal: AbortSignal) => Promise<LyricsResult | null>>,
  signal?: AbortSignal,
  timeoutMs = AUTO_LOOKUP_TIMEOUT_MS,
  timeoutAsError = false,
): Promise<LyricsResult | null> {
  if (signal?.aborted) throw abortError();

  const controllers = loaders.map(() => new AbortController());
  const abortAll = () => {
    for (const controller of controllers) controller.abort();
  };

  let removeParentAbort = () => {};
  try {
    return await new Promise<LyricsResult | null>((resolve, reject) => {
      let settled = false;
      let pending = loaders.length;
      let sawEmptyResult = false;
      let firstError: unknown = null;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        abortAll();
        if (timeoutAsError) {
          reject(new RequestTimeoutError('lyrics transcription', timeoutMs));
        } else {
          resolve(null);
        }
      }, timeoutMs);

      const finish = (result: LyricsResult | null, error?: unknown) => {
        if (settled) return;
        if (hasLyrics(result)) {
          settled = true;
          clearTimeout(timer);
          abortAll();
          resolve(result);
          return;
        }

        sawEmptyResult ||= error === undefined;
        firstError ??= error;
        pending -= 1;
        if (pending > 0) return;

        settled = true;
        clearTimeout(timer);
        abortAll();
        if (sawEmptyResult) resolve(null);
        else reject(firstError ?? new Error('Lyrics lookup failed'));
      };

      const onParentAbort = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        abortAll();
        reject(abortError());
      };
      signal?.addEventListener('abort', onParentAbort, { once: true });
      removeParentAbort = () => signal?.removeEventListener('abort', onParentAbort);

      loaders.forEach((loader, index) => {
        void loader(controllers[index].signal).then(
          (result) => finish(result),
          (error: unknown) => finish(null, error),
        );
      });
    });
  } finally {
    removeParentAbort();
  }
}

async function getDirectExactLyrics(
  artist: string,
  title: string,
  durationMs: number | undefined,
  signal: AbortSignal,
): Promise<LyricsResult | null> {
  const params = new URLSearchParams({ artist_name: artist, track_name: title });
  if (durationMs && Number.isFinite(durationMs) && durationMs > 0) {
    params.set('duration', String(Math.round(durationMs / 1000)));
  }

  const response = await edgeFetch(
    `https://lrclib.net/api/get?${params}`,
    { signal, headers: LRCLIB_HEADERS },
    DIRECT_LYRICS_TIMEOUT_MS,
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`LRCLIB get ${response.status}`);
  return toLrcLibResult(
    await withTimeout(
      response.json() as Promise<LrcLibResponse>,
      LYRICS_BODY_TIMEOUT_MS,
      'LRCLIB exact body',
    ),
  );
}

function normalized(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function searchScore(
  candidate: LrcLibResponse,
  artist: string,
  title: string,
  durationMs?: number,
): number {
  const expectedArtist = normalized(artist);
  const expectedTitle = normalized(title);
  const candidateArtist = normalized(candidate.artistName ?? '');
  const candidateTitle = normalized(candidate.trackName ?? '');
  let score = 0;

  if (candidateArtist === expectedArtist) score += 5;
  else if (candidateArtist.includes(expectedArtist) || expectedArtist.includes(candidateArtist)) {
    score += 2;
  }
  if (candidateTitle === expectedTitle) score += 7;
  else if (candidateTitle.includes(expectedTitle) || expectedTitle.includes(candidateTitle)) {
    score += 3;
  }

  if (durationMs && candidate.duration) {
    const delta = Math.abs(candidate.duration - durationMs / 1000);
    if (delta <= 3) score += 4;
    else if (delta <= 8) score += 1;
    else if (delta > 20) score -= 3;
  }
  return score;
}

async function getDirectSearchLyrics(
  artist: string,
  title: string,
  durationMs: number | undefined,
  signal: AbortSignal,
): Promise<LyricsResult | null> {
  const params = new URLSearchParams({ artist_name: artist, track_name: title });
  const response = await edgeFetch(
    `https://lrclib.net/api/search?${params}`,
    { signal, headers: LRCLIB_HEADERS },
    DIRECT_LYRICS_TIMEOUT_MS,
  );
  if (!response.ok) throw new Error(`LRCLIB search ${response.status}`);
  const candidates = await withTimeout(
    response.json() as Promise<LrcLibResponse[]>,
    LYRICS_BODY_TIMEOUT_MS,
    'LRCLIB search body',
  );
  const ranked = candidates
    .filter((candidate) => !candidate.instrumental)
    .map((candidate) => ({ candidate, score: searchScore(candidate, artist, title, durationMs) }))
    .sort((left, right) => right.score - left.score);
  if (!ranked[0] || ranked[0].score < 7) return null;
  return toLrcLibResult(ranked[0].candidate);
}

async function getLrcLibLyrics(
  artist: string,
  title: string,
  durationMs: number | undefined,
  signal: AbortSignal,
): Promise<LyricsResult | null> {
  try {
    const exact = await getDirectExactLyrics(artist, title, durationMs, signal);
    if (exact || signal.aborted) return exact;
  } catch (error) {
    if (signal.aborted) throw error;
  }
  return getDirectSearchLyrics(artist, title, durationMs, signal);
}

async function getBackendLyrics(
  path: string,
  signal: AbortSignal,
  allowGenerated: boolean,
  timeoutMs = BACKEND_LYRICS_TIMEOUT_MS,
): Promise<LyricsResult | null> {
  try {
    const data = await api<BackendLyricsResponse>(
      path,
      { signal, silentStatuses: BACKEND_SILENT_STATUSES },
      timeoutMs,
    );
    const result = toResult(data);
    if (!allowGenerated && result?.source === 'self_gen') return null;
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Load provider-backed lyrics. AI transcription is explicitly excluded here. */
export async function getLyricsByTrack(
  track: LyricsTrackLookup,
  signal?: AbortSignal,
): Promise<LyricsResult | null> {
  const cacheKey = trackLyricsCacheKey(track.scTrackId);
  const cached = await getCachedLyrics(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    artist: track.artist,
    title: track.title,
    transcribe: 'false',
  });
  if (track.durationMs && Number.isFinite(track.durationMs) && track.durationMs > 0) {
    params.set('duration', String(Math.round(track.durationMs / 1000)));
  }
  const result = await firstAvailableLyrics(
    [
      (childSignal) => getLrcLibLyrics(track.artist, track.title, track.durationMs, childSignal),
      (childSignal) => getBackendLyrics(`/lyrics/search?${params}`, childSignal, false),
    ],
    signal,
  );
  if (result) await cacheLyrics(cacheKey, result);
  return result;
}

/** Manual provider search. It never starts transcription. */
export async function searchLyricsManual(
  artist: string,
  title: string,
  durationMs?: number,
  signal?: AbortSignal,
): Promise<LyricsResult | null> {
  const cacheKey = searchLyricsCacheKey(artist, title, durationMs);
  const cached = await getCachedLyrics(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({ artist, title, transcribe: 'false' });
  if (durationMs && Number.isFinite(durationMs) && durationMs > 0) {
    params.set('duration', String(Math.round(durationMs / 1000)));
  }
  const result = await firstAvailableLyrics(
    [
      (childSignal) => getLrcLibLyrics(artist, title, durationMs, childSignal),
      (childSignal) => getBackendLyrics(`/lyrics/search?${params}`, childSignal, false),
    ],
    signal,
  );
  if (result) await cacheLyrics(cacheKey, result);
  return result;
}

/** Explicit opt-in for the backend's transcription fallback. */
export async function requestLyricsTranscription(
  track: LyricsTrackLookup,
  signal?: AbortSignal,
): Promise<LyricsResult | null> {
  const transcriptionKey = transcriptionLyricsCacheKey(track.scTrackId);
  const cached = await getCachedLyrics(transcriptionKey);
  if (cached) return cached;

  const params = new URLSearchParams({ transcribe: 'true' });
  const result = await firstAvailableLyrics(
    [
      (childSignal) =>
        getBackendLyrics(
          `/lyrics/${encodeURIComponent(track.scTrackId)}?${params}`,
          childSignal,
          true,
          TRANSCRIPTION_TIMEOUT_MS,
        ),
    ],
    signal,
    TRANSCRIPTION_TIMEOUT_MS,
    true,
  );
  if (result) {
    await cacheLyrics(transcriptionKey, result);
    await cacheLyrics(trackLyricsCacheKey(track.scTrackId), result);
  }
  return result;
}
