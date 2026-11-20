import { toast } from 'sonner';
import i18n from '../i18n';
import { selectAppMode, useAppStatusStore } from '../stores/app-status';
import { useAuthStore } from '../stores/auth';
import { type PendingOwnLyrics, pendingOwnLyrics, useOwnLyricsStore } from '../stores/own-lyrics';
import { ApiError, api } from './api';
import { resetDiscordLyrics } from './discord-lyrics';
import {
  type BackendLyricsResponse,
  type LyricsResult,
  localOwnResult,
  type OwnLyricsInput,
  toResult,
} from './lyrics';
import { queryClient } from './query-client';

const RETRY_MS = 30_000;
const REFUSED = new Set([400, 409, 413, 422]);

export interface LyricsCandidate {
  lrclibId: number;
  artist: string;
  title: string;
  album: string | null;
  durationSec: number | null;
  syncedLrc: string | null;
  plainText: string | null;
}

let flushing: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function lyricsKey(urn: string) {
  return ['lyrics', 'track', urn];
}

function show(urn: string, result: LyricsResult | null) {
  queryClient.setQueryData(lyricsKey(urn), result);
  resetDiscordLyrics();
}

function refused(error: unknown): boolean {
  return error instanceof ApiError && REFUSED.has(error.status);
}

function online(): boolean {
  return selectAppMode(useAppStatusStore.getState()) === 'online';
}

async function send(entry: PendingOwnLyrics): Promise<void> {
  const { urn } = entry;
  try {
    const saved = await api<BackendLyricsResponse>(`/lyrics/${encodeURIComponent(urn)}/own`, {
      method: 'PUT',
      body: JSON.stringify(entry.input),
    });
    useOwnLyricsStore.getState().drop(entry);
    if (!pendingOwnLyrics(urn)) show(urn, toResult(saved));
  } catch (error) {
    if (!refused(error)) throw error;
    useOwnLyricsStore.getState().drop(entry);
    toast.error(i18n.t('lyricsOwn.saveRefused'));
    void queryClient.invalidateQueries({ queryKey: lyricsKey(urn) });
  }
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flushOwnLyrics();
  }, RETRY_MS);
}

export function flushOwnLyrics(): Promise<void> {
  flushing ??= (async () => {
    const user = useAuthStore.getState().user?.urn;
    if (!user || !online()) return;
    let failed = false;
    for (const entry of Object.values(useOwnLyricsStore.getState().pending)) {
      if (entry.user !== user) continue;
      await send(entry).catch(() => {
        failed = true;
      });
    }
    if (failed) scheduleRetry();
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

export function saveOwnLyrics(urn: string, input: OwnLyricsInput): Promise<void> {
  const user = useAuthStore.getState().user?.urn;
  if (!user) return Promise.resolve();
  const entry = { user, urn, input, at: Date.now() };
  useOwnLyricsStore.getState().keep(entry);
  show(urn, localOwnResult(urn, input, false));
  return send(entry).catch(() => {
    const waiting = pendingOwnLyrics(urn);
    if (waiting) show(urn, localOwnResult(urn, waiting.input));
    scheduleRetry();
  });
}

export async function removeOwnLyrics(urn: string): Promise<void> {
  const waiting = pendingOwnLyrics(urn);
  if (waiting) useOwnLyricsStore.getState().drop(waiting);
  try {
    await api(`/lyrics/${encodeURIComponent(urn)}/own`, { method: 'DELETE' });
  } catch (error) {
    if (waiting) useOwnLyricsStore.getState().keep(waiting);
    toast.error(i18n.t('lyricsOwn.resetFailed'));
    throw error;
  }
  resetDiscordLyrics();
  await queryClient.invalidateQueries({ queryKey: lyricsKey(urn) });
}

export async function searchLyricsCandidates(
  query: string,
  durationMs?: number,
): Promise<LyricsCandidate[]> {
  const params = new URLSearchParams({ q: query });
  if (durationMs && Number.isFinite(durationMs) && durationMs > 0) {
    params.set('duration', String(Math.round(durationMs)));
  }
  const reply = await api<{ candidates: LyricsCandidate[] }>(
    `/lyrics/candidates?${params}`,
    { quiet: true },
    30_000,
  );
  return reply.candidates;
}

export function startOwnLyricsSync() {
  const flush = () => void flushOwnLyrics();
  if (useOwnLyricsStore.persist.hasHydrated()) flush();
  else useOwnLyricsStore.persist.onFinishHydration(flush);
  useAppStatusStore.subscribe((state, prev) => {
    if (selectAppMode(state) === 'online' && selectAppMode(prev) !== 'online') flush();
  });
  useAuthStore.subscribe((state, prev) => {
    if (state.user?.urn && state.user.urn !== prev.user?.urn) flush();
  });
}
