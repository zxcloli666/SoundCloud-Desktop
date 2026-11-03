import { ApiError } from './api';
import type { ImportKind, ImportRequest, SyncTarget } from './import-session';
import { tauriStorage } from './tauri-storage';

const STORE_KEY = 'import-sync';

export const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const SYNC_TICK_MS = 60 * 1000;
export const SYNC_FIRST_TICK_MS = 20 * 1000;
export const PLAYLIST_LIMIT = 500;

const BACKOFF_START_MS = 15 * 60 * 1000;
const HALTING_CODES = ['ym_token_invalid', 'target_missing'];

export interface SyncEntry {
  id: string;
  title: string;
  kind: ImportKind;
  request: ImportRequest;
  target: SyncTarget;
  enabled: boolean;
  seen: string[];
  added: string[];
  latest: string[];
  removed: string[];
  lastAt: number;
  nextAt: number;
  fresh: number;
  error: string | null;
  failures: number;
}

export interface SyncPulled {
  title: string;
  seen: string[];
  added: string[];
  latest: string[];
  removed: string[];
  to_add: string[];
  fresh: number;
  unmatched: number;
}

export async function loadSyncEntries(): Promise<SyncEntry[]> {
  try {
    const raw = await tauriStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveSyncEntries(entries: SyncEntry[]) {
  try {
    await tauriStorage.setItem(STORE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn('[Import] could not store sync state', error);
  }
}

export function errorCodeOf(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof ApiError && error.status === 404) return 'target_missing';
  if (error instanceof ApiError) return 'save_failed';
  return 'unknown';
}

export function isHalting(code: string): boolean {
  return HALTING_CODES.includes(code);
}

export function backoffMs(failures: number): number {
  return Math.min(SYNC_INTERVAL_MS, BACKOFF_START_MS * 2 ** Math.max(0, failures - 1));
}

export function nextDue(entries: SyncEntry[], now: number): SyncEntry | null {
  const due = entries.filter(
    (entry) => entry.enabled && !isHalting(entry.error ?? '') && entry.nextAt <= now,
  );
  due.sort((a, b) => a.nextAt - b.nextAt);
  return due[0] ?? null;
}

export function withToken(request: ImportRequest, token: string): ImportRequest {
  if (request.kind === 'ym_likes' || request.kind === 'ym_playlist') return { ...request, token };
  if (request.kind === 'link') return { ...request, token };
  return request;
}

export function agoOf(at: number, language: string): string {
  const minutes = Math.round((at - Date.now()) / 60_000);
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return format.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return format.format(hours, 'hour');
  return format.format(Math.round(hours / 24), 'day');
}
