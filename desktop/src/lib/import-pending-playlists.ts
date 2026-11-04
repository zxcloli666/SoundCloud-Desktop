import type { PlaylistCreate } from './sync-status';
import { tauriStorage } from './tauri-storage';

const STORAGE_KEY = 'ym-import-pending';
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const GONE_TTL_MS = 60 * 60 * 1000;

interface PendingCreate {
  owner: string;
  title: string;
  queuedAt: number;
  targetUrn?: string;
  goneAt?: number;
}

interface ImportPlaylist {
  urn: string;
  title: string;
}

export interface PendingCreates {
  titles: Set<string>;
  createdUrns: string[];
}

function isPendingCreate(value: unknown): value is PendingCreate {
  if (!value || typeof value !== 'object') return false;
  const entry = value as PendingCreate;
  return (
    typeof entry.owner === 'string' &&
    typeof entry.title === 'string' &&
    typeof entry.queuedAt === 'number'
  );
}

async function readEntries(): Promise<PendingCreate[]> {
  try {
    const raw = await tauriStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isPendingCreate) : [];
  } catch {
    return [];
  }
}

async function writeEntries(entries: PendingCreate[]) {
  try {
    await tauriStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn('[Import] could not remember queued playlists:', error);
  }
}

export async function loadPendingCreates(
  owner: string,
  existing: ImportPlaylist[],
  creates: PlaylistCreate[] | null,
  truncated: boolean,
): Promise<PendingCreates> {
  const now = Date.now();
  const entries = await readEntries();
  const onServer = new Set(creates?.map((create) => create.targetUrn));
  const createdUrns: string[] = [];
  const kept: PendingCreate[] = [];

  for (const entry of entries) {
    const mine = entry.owner === owner;
    const created = mine && existing.find((playlist) => playlist.title === entry.title);
    if (created) {
      createdUrns.push(created.urn);
      continue;
    }
    const urn = mine && creates ? entry.targetUrn : undefined;
    if (urn && onServer.has(urn)) {
      kept.push(entry);
    } else if (urn && !truncated) {
      const goneAt = entry.goneAt ?? now;
      if (now - goneAt < GONE_TTL_MS) kept.push(entry.goneAt ? entry : { ...entry, goneAt });
    } else if (now - entry.queuedAt < PENDING_TTL_MS) {
      kept.push(entry);
    }
  }

  if (kept.length !== entries.length || kept.some((entry, i) => entry !== entries[i])) {
    await writeEntries(kept);
  }

  const titles = new Set(kept.filter((entry) => entry.owner === owner).map((entry) => entry.title));
  return { titles, createdUrns };
}

export async function rememberPendingCreate(owner: string, title: string, targetUrn?: string) {
  const entries = await readEntries();
  const others = entries.filter((entry) => entry.owner !== owner || entry.title !== title);
  await writeEntries([...others, { owner, title, queuedAt: Date.now(), targetUrn }]);
}
