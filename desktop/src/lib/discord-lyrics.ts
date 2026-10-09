import { getLyricsByTrack, type LyricLine, type LyricsResult } from './lyrics';
import { queryClient } from './query-client';

const PENDING_RECHECK_MS = 30_000;

let urn: string | null = null;
let lines: LyricLine[] | null = null;
let settled = false;
let checkedAt = 0;
let loading: Promise<void> | null = null;

function lyricsKey(trackUrn: string) {
  return ['lyrics', 'track', trackUrn];
}

function apply(trackUrn: string, result: LyricsResult | null | undefined) {
  if (urn !== trackUrn) return;
  lines = result?.synced ?? null;
  settled = result?.status !== 'pending';
  checkedAt = Date.now();
}

export function lyricLineAt(synced: LyricLine[], time: number): string | null {
  let low = 0;
  let high = synced.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (synced[mid].time <= time) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  const text = found >= 0 ? synced[found].text.trim() : '';
  return text || null;
}

function adoptCached(trackUrn: string) {
  const cached = queryClient.getQueryData<LyricsResult | null>(lyricsKey(trackUrn));
  if (cached !== undefined && cached?.status !== 'pending') apply(trackUrn, cached);
}

function loadDiscordLyrics(trackUrn: string): Promise<void> {
  if (urn !== trackUrn) {
    urn = trackUrn;
    lines = null;
    settled = false;
    checkedAt = 0;
    loading = null;
  }
  if (!settled) adoptCached(trackUrn);
  if (loading || settled || Date.now() - checkedAt < PENDING_RECHECK_MS) {
    return loading ?? Promise.resolve();
  }
  checkedAt = Date.now();
  loading = queryClient
    .fetchQuery({
      queryKey: lyricsKey(trackUrn),
      queryFn: () => getLyricsByTrack(trackUrn),
      staleTime: 0,
    })
    .then((result) => apply(trackUrn, result))
    .catch(() => {
      if (urn === trackUrn) settled = true;
    })
    .finally(() => {
      if (urn === trackUrn) loading = null;
    });
  return loading;
}

export function discordLyricLine(trackUrn: string, time: number): string | null {
  if (urn !== trackUrn) {
    void loadDiscordLyrics(trackUrn);
    return null;
  }
  if (!settled) void loadDiscordLyrics(trackUrn);
  return lines ? lyricLineAt(lines, time) : null;
}

export function resetDiscordLyrics() {
  urn = null;
  lines = null;
  settled = false;
  checkedAt = 0;
  loading = null;
}
