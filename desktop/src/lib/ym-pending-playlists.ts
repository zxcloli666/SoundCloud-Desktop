import { tauriStorage } from './tauri-storage';

const STORAGE_KEY = 'ym-import-pending';
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

interface PendingCreate {
  owner: string;
  title: string;
  targetUrn: string;
  queuedAt: number;
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
    console.warn('[YM Import] could not remember queued playlists:', error);
  }
}

export async function loadPendingCreates(
  owner: string,
  existingTitles: string[],
): Promise<Set<string>> {
  const now = Date.now();
  const entries = await readEntries();
  const kept = entries.filter(
    (entry) =>
      now - entry.queuedAt < PENDING_TTL_MS &&
      !(entry.owner === owner && existingTitles.includes(entry.title)),
  );
  if (kept.length !== entries.length) await writeEntries(kept);

  return new Set(kept.filter((entry) => entry.owner === owner).map((entry) => entry.title));
}

export async function rememberPendingCreate(owner: string, title: string, targetUrn: string) {
  const entries = await readEntries();
  const others = entries.filter((entry) => entry.owner !== owner || entry.title !== title);
  await writeEntries([...others, { owner, title, targetUrn, queuedAt: Date.now() }]);
}
