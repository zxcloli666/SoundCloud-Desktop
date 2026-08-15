import { ApiError, api } from './api';
import { edgeFetch } from './edge';

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

const DIRECT_LYRICS_TIMEOUT_MS = 12_000;
const BACKEND_LYRICS_TIMEOUT_MS = 25_000;
const BACKEND_SILENT_STATUSES = [404, 500, 502, 503, 504];

/** Parse LRC format: [mm:ss.xx] text */
export function parseLRC(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of lrc.split('\n')) {
    const m = raw.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/);
    if (!m) continue;
    const time = +m[1] * 60 + +m[2] + +m[3].padEnd(3, '0') / 1000;
    const text = m[4].trim();
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

function hasLyrics(result: LyricsResult | null): result is LyricsResult {
  return !!(result?.plain?.trim() || (result?.synced && result.synced.length > 0));
}

function abortError(): DOMException {
  return new DOMException('Lyrics lookup canceled', 'AbortError');
}

async function firstAvailableLyrics(
  loaders: Array<(signal: AbortSignal) => Promise<LyricsResult | null>>,
  signal?: AbortSignal,
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
      let generatedFallback: LyricsResult | null = null;

      const finish = (result: LyricsResult | null, error?: unknown) => {
        if (settled) return;
        if (hasLyrics(result) && result.source !== 'self_gen') {
          settled = true;
          abortAll();
          resolve(result);
          return;
        }

        // AI transcription is a last resort: keep it ready, but let every provider-backed
        // lookup finish before accepting it. A cached self_gen response must not cancel
        // a slightly slower LRCLIB/Musixmatch/Genius/NetEase result.
        if (hasLyrics(result)) generatedFallback ??= result;
        else sawEmptyResult ||= error === undefined;
        firstError ??= error;
        pending -= 1;
        if (pending > 0) return;

        settled = true;
        abortAll();
        if (generatedFallback) resolve(generatedFallback);
        else if (sawEmptyResult) resolve(null);
        else reject(firstError ?? new Error('Lyrics lookup failed'));
      };

      const onParentAbort = () => {
        if (settled) return;
        settled = true;
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

async function getDirectLyrics(
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
    {
      signal,
      headers: { 'User-Agent': 'Hellishfy (https://github.com/hexnow/Hellishfy)' },
    },
    DIRECT_LYRICS_TIMEOUT_MS,
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`LRCLIB ${response.status}`);

  const data = (await response.json()) as LrcLibResponse;
  if (data.instrumental) return null;
  const synced = data.syncedLyrics ? parseLRC(data.syncedLyrics) : null;
  return {
    plain: data.plainLyrics,
    synced: synced && synced.length > 0 ? synced : null,
    source: 'lrclib',
    language: null,
  };
}

async function getBackendLyrics(path: string, signal: AbortSignal): Promise<LyricsResult | null> {
  try {
    const data = await api<BackendLyricsResponse>(
      path,
      { signal, silentStatuses: BACKEND_SILENT_STATUSES },
      BACKEND_LYRICS_TIMEOUT_MS,
    );
    return toResult(data);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Load lyrics by track URN/id. Backend resolves artist/title itself and writes to cache. */
export function getLyricsByTrack(
  track: LyricsTrackLookup,
  signal?: AbortSignal,
): Promise<LyricsResult | null> {
  return firstAvailableLyrics(
    [
      (childSignal) => getDirectLyrics(track.artist, track.title, track.durationMs, childSignal),
      (childSignal) =>
        getBackendLyrics(`/lyrics/${encodeURIComponent(track.scTrackId)}`, childSignal),
    ],
    signal,
  );
}

/** Manual search — preview only. Backend does NOT read or write cache. */
export function searchLyricsManual(
  artist: string,
  title: string,
  durationMs?: number,
  signal?: AbortSignal,
): Promise<LyricsResult | null> {
  const params = new URLSearchParams({ artist, title });
  if (durationMs && Number.isFinite(durationMs) && durationMs > 0) {
    params.set('duration', String(Math.round(durationMs)));
  }
  return firstAvailableLyrics(
    [
      (childSignal) => getDirectLyrics(artist, title, durationMs, childSignal),
      (childSignal) => getBackendLyrics(`/lyrics/search?${params}`, childSignal),
    ],
    signal,
  );
}
