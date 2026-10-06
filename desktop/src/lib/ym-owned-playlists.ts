import { tauriStorage } from './tauri-storage';

const STORAGE_KEY = 'ym-import-owned';

interface OwnedPlaylist {
  owner: string;
  urn: string;
}

function isOwnedPlaylist(value: unknown): value is OwnedPlaylist {
  if (!value || typeof value !== 'object') return false;
  const entry = value as OwnedPlaylist;
  return typeof entry.owner === 'string' && typeof entry.urn === 'string';
}

async function readEntries(): Promise<OwnedPlaylist[]> {
  try {
    const raw = await tauriStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isOwnedPlaylist) : [];
  } catch {
    return [];
  }
}

export async function loadOwnedPlaylists(owner: string): Promise<Set<string>> {
  const entries = await readEntries();
  return new Set(entries.filter((entry) => entry.owner === owner).map((entry) => entry.urn));
}

export async function rememberOwnedPlaylists(owner: string, urns: string[]) {
  const entries = await readEntries();
  const known = new Set(entries.filter((entry) => entry.owner === owner).map((entry) => entry.urn));
  const added = urns.filter((urn) => !known.has(urn)).map((urn) => ({ owner, urn }));
  if (added.length === 0) return;
  try {
    await tauriStorage.setItem(STORAGE_KEY, JSON.stringify([...entries, ...added]));
  } catch (error) {
    console.warn('[YM Import] could not remember imported playlists:', error);
  }
}

export async function forgetOwnedPlaylists(owner: string, urns: string[]) {
  const removed = new Set(urns);
  const entries = await readEntries();
  const kept = entries.filter((entry) => entry.owner !== owner || !removed.has(entry.urn));
  if (kept.length === entries.length) return;
  try {
    await tauriStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
  } catch (error) {
    console.warn('[YM Import] could not forget deleted playlists:', error);
  }
}
