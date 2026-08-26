import {BaseDirectory, exists, mkdir, readTextFile, writeTextFile} from '@tauri-apps/plugin-fs';
import type {Track} from '../stores/player';

const BASE_DIR = BaseDirectory.AppData;
const INDEX_PATH = 'offline-index.json';
const MAX_REMEMBERED_TRACKS = 2500;
const PERSIST_DELAY_MS = 900;

interface OfflineIndex {
  likedUrns: string[];
  tracksByUrn: Record<string, Track>;
  updatedAt: number | null;
  /** User-arranged order of the cached list ("Свой порядок" sort mode). */
  cacheOrder: string[];
}

const EMPTY_INDEX: OfflineIndex = {
  likedUrns: [],
  tracksByUrn: {},
  updatedAt: null,
  cacheOrder: [],
};

let indexCache: OfflineIndex | null = null;
let loadPromise: Promise<OfflineIndex> | null = null;
let cancelScheduledPersist: (() => void) | null = null;
let writeChain = Promise.resolve();
let dirReady: Promise<void> | null = null;

function ensureDir() {
  if (!dirReady) {
    dirReady = mkdir('', { baseDir: BASE_DIR, recursive: true }).catch(() => {});
  }
  return dirReady;
}

function cloneTrack(track: Track): Track {
  return {
    ...track,
    user: { ...track.user },
  };
}

function trackChanged(previous: Track | undefined, next: Track): boolean {
  if (!previous) return true;
  // Metadata objects arrive as new references on every request. A structural
  // comparison is still far cheaper than serialising and rewriting the entire
  // offline index when the actual track did not change.
  return JSON.stringify(previous) !== JSON.stringify(next);
}

function pruneTrackIndex(index: OfflineIndex): void {
  const keys = Object.keys(index.tracksByUrn);
  if (keys.length <= MAX_REMEMBERED_TRACKS) return;

  const protectedUrns = new Set([...index.likedUrns, ...index.cacheOrder]);
  let removeCount = keys.length - MAX_REMEMBERED_TRACKS;
  for (const urn of keys) {
    if (removeCount <= 0) break;
    if (protectedUrns.has(urn)) continue;
    delete index.tracksByUrn[urn];
    removeCount--;
  }
}

async function readIndexFile(): Promise<OfflineIndex> {
  await ensureDir();

  try {
    if (!(await exists(INDEX_PATH, { baseDir: BASE_DIR }))) {
      return EMPTY_INDEX;
    }

    const raw = await readTextFile(INDEX_PATH, { baseDir: BASE_DIR });
    const parsed = JSON.parse(raw) as OfflineIndex;
    return {
      likedUrns: Array.isArray(parsed.likedUrns) ? parsed.likedUrns : [],
      tracksByUrn: parsed.tracksByUrn ?? {},
      updatedAt: parsed.updatedAt ?? null,
      cacheOrder: Array.isArray(parsed.cacheOrder) ? parsed.cacheOrder : [],
    };
  } catch {
    return EMPTY_INDEX;
  }
}

async function loadIndex(): Promise<OfflineIndex> {
  if (indexCache) {
    return indexCache;
  }

  if (!loadPromise) {
    loadPromise = readIndexFile()
      .then((parsed) => {
        indexCache = parsed;
        return parsed;
      })
      .finally(() => {
        loadPromise = null;
      });
  }

  return loadPromise;
}

function persistSnapshot() {
  cancelScheduledPersist?.();
  cancelScheduledPersist = null;
  if (!indexCache) return;

  pruneTrackIndex(indexCache);
  const snapshot = JSON.stringify(indexCache);
  writeChain = writeChain
    .then(() => ensureDir())
    .then(() => writeTextFile(INDEX_PATH, snapshot, { baseDir: BASE_DIR }))
    .catch(() => {});
}

function schedulePersist() {
  cancelScheduledPersist?.();

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    const handle = window.requestIdleCallback(() => persistSnapshot(), {
      timeout: PERSIST_DELAY_MS * 2,
    });
    cancelScheduledPersist = () => window.cancelIdleCallback(handle);
    return;
  }

  const handle = setTimeout(persistSnapshot, PERSIST_DELAY_MS);
  cancelScheduledPersist = () => clearTimeout(handle);
}

export async function rememberTracks(tracks: Track[]) {
  if (tracks.length === 0) return;

  const index = await loadIndex();
  let changed = false;

  for (const track of tracks) {
    if (!track?.urn) continue;
    if (!trackChanged(index.tracksByUrn[track.urn], track)) continue;
    // Reinsert changed tracks at the end so object insertion order doubles as
    // a cheap LRU signal for bounded pruning.
    delete index.tracksByUrn[track.urn];
    index.tracksByUrn[track.urn] = cloneTrack(track);
    changed = true;
  }

  if (changed) {
    schedulePersist();
  }
}

export async function rememberLikedTracks(tracks: Track[]) {
  const index = await loadIndex();
  let changed = false;
  for (const track of tracks) {
    if (!track?.urn) continue;
    if (!trackChanged(index.tracksByUrn[track.urn], track)) continue;
    delete index.tracksByUrn[track.urn];
    index.tracksByUrn[track.urn] = cloneTrack(track);
    changed = true;
  }

  const likedUrns = tracks.map((track) => track.urn);
  const likedChanged =
    likedUrns.length !== index.likedUrns.length ||
    likedUrns.some((urn, indexPosition) => urn !== index.likedUrns[indexPosition]);
  if (likedChanged) {
    index.likedUrns = likedUrns;
    index.updatedAt = Date.now();
    changed = true;
  }
  if (changed) schedulePersist();
}

export async function getOfflineLikedTracks() {
  const index = await loadIndex();
  return index.likedUrns
    .map((urn) => index.tracksByUrn[urn])
    .filter((track): track is Track => Boolean(track));
}

export async function getOfflineTracksByUrns(urns: string[]) {
  const index = await loadIndex();
  return urns
    .map((urn) => index.tracksByUrn[urn])
    .filter((track): track is Track => Boolean(track));
}

export async function getOfflineIndexUpdatedAt() {
  const index = await loadIndex();
  return index.updatedAt;
}

export async function getCacheOrder(): Promise<string[]> {
  const index = await loadIndex();
  return index.cacheOrder;
}

export async function saveCacheOrder(urns: string[]) {
  const index = await loadIndex();
  if (
    urns.length === index.cacheOrder.length &&
    urns.every((urn, indexPosition) => urn === index.cacheOrder[indexPosition])
  ) {
    return;
  }
  index.cacheOrder = urns;
  schedulePersist();
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && cancelScheduledPersist) persistSnapshot();
  });
  window.addEventListener('beforeunload', () => {
    if (cancelScheduledPersist) persistSnapshot();
  });
}
