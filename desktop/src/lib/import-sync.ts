import { ApiError } from './api';
import { trackedInvoke as invoke } from './diagnostics';
import type { ImportKind, ImportRequest, SyncTarget } from './import-session';
import { tauriStorage } from './tauri-storage';

const LEGACY_KEY = 'import-sync';

export const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const SYNC_TICK_MS = 60 * 1000;
export const SYNC_FIRST_TICK_MS = 20 * 1000;

const BACKOFF_START_MS = 15 * 60 * 1000;
const HALTING_CODES = ['ym_token_invalid', 'target_missing'];

export interface SyncEntry {
  id: string;
  title: string;
  kind: ImportKind;
  request: ImportRequest;
  target: SyncTarget;
  baseTitle: string;
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

export interface SyncFile {
  ymToken: string | null;
  entries: SyncEntry[];
}

export async function loadSyncFile(): Promise<SyncFile> {
  void tauriStorage.removeItem(LEGACY_KEY);
  try {
    const raw = await invoke<string | null>('import_sync_load');
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      ymToken: typeof parsed?.ymToken === 'string' ? parsed.ymToken : null,
      entries: Array.isArray(parsed?.entries) ? parsed.entries : [],
    };
  } catch {
    return { ymToken: null, entries: [] };
  }
}

export async function saveSyncFile(file: SyncFile) {
  try {
    await invoke('import_sync_store', { json: JSON.stringify(file) });
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

export function agoOf(at: number, language: string): string {
  const minutes = Math.round((at - Date.now()) / 60_000);
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return format.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return format.format(hours, 'hour');
  return format.format(Math.round(hours / 24), 'day');
}
