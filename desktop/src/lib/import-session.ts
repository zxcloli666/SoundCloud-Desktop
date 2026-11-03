import type { Track } from '../stores/player';
import { tauriStorage } from './tauri-storage';

const SESSION_KEY = 'import-session';
const HISTORY_KEY = 'import-history';
const HISTORY_LIMIT = 20;
const RERUN_TEXT_LIMIT = 200_000;

export type ImportKind = 'ym_likes' | 'ym_playlist' | 'spotify' | 'youtube' | 'yandex' | 'text';

export type ImportRequest =
  | { kind: 'ym_likes'; token: string }
  | { kind: 'ym_playlist'; token: string; owner: string; playlist: string }
  | { kind: 'link'; url: string; token?: string }
  | { kind: 'text'; text: string };

export interface ImportRow {
  position: number;
  artist: string;
  title: string;
  urn: string | null;
}

export type DestinationMode = 'create' | 'likes' | 'existing';

export interface ImportDestination {
  mode: DestinationMode;
  name: string;
  playlistUrn: string | null;
}

export interface StoredSession {
  kind: ImportKind;
  title: string;
  rows: ImportRow[];
  destination: ImportDestination;
  total: number;
  at: number;
}

export interface HistoryEntry {
  id: string;
  at: number;
  kind: ImportKind;
  title: string;
  total: number;
  found: number;
  request: ImportRequest | null;
  playlistUrn: string | null;
}

export type TrackMap = Record<string, Track>;

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await tauriStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown) {
  try {
    await tauriStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('[Import] could not store', key, error);
  }
}

export const loadSession = () => readJson<StoredSession>(SESSION_KEY);

export const saveSession = (session: StoredSession) => writeJson(SESSION_KEY, session);

export const clearSession = () => tauriStorage.removeItem(SESSION_KEY);

export async function loadHistory(): Promise<HistoryEntry[]> {
  const entries = await readJson<HistoryEntry[]>(HISTORY_KEY);
  return Array.isArray(entries) ? entries : [];
}

export function rerunnable(request: ImportRequest): ImportRequest | null {
  if (request.kind === 'text') {
    return request.text.length <= RERUN_TEXT_LIMIT ? request : null;
  }
  if (request.kind === 'link') return { kind: 'link', url: request.url };
  return null;
}

export async function addHistory(entry: HistoryEntry): Promise<HistoryEntry[]> {
  const entries = [entry, ...(await loadHistory())].slice(0, HISTORY_LIMIT);
  await writeJson(HISTORY_KEY, entries);
  return entries;
}

export async function removeHistory(id: string): Promise<HistoryEntry[]> {
  const entries = (await loadHistory()).filter((entry) => entry.id !== id);
  await writeJson(HISTORY_KEY, entries);
  return entries;
}
