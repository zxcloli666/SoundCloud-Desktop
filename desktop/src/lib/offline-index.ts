import {BaseDirectory, exists, mkdir, readTextFile, writeTextFile} from '@tauri-apps/plugin-fs';
import type {Track} from '../stores/player';

const BASE_DIR = BaseDirectory.AppData;
const INDEX_PATH = 'offline-index.json';

export type OfflineCollectionKind = 'playlist' | 'album';

export interface OfflineCollectionMeta {
  kind: OfflineCollectionKind;
  title: string;
  author: string;
  artworkUrl: string | null;
}

export interface OfflineCollection extends OfflineCollectionMeta {
  scope: string;
  trackUrns: string[];
  savedAt: number;
}

interface OfflineIndex {
  likedUrns: string[];
  tracksByUrn: Record<string, Track>;
  updatedAt: number | null;
  /** User-arranged order of the cached list ("Свой порядок" sort mode). */
  cacheOrder: string[];
  collections: Record<string, OfflineCollection>;
  pinnedUrns: string[];
}

const emptyIndex = (): OfflineIndex => ({
  likedUrns: [],
  tracksByUrn: {},
  updatedAt: null,
  cacheOrder: [],
  collections: {},
  pinnedUrns: [],
});

let indexCache: OfflineIndex | null = null;
let loadPromise: Promise<OfflineIndex> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
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

async function readIndexFile(): Promise<OfflineIndex> {
  await ensureDir();

  try {
    if (!(await exists(INDEX_PATH, { baseDir: BASE_DIR }))) {
      return emptyIndex();
    }

    const raw = await readTextFile(INDEX_PATH, { baseDir: BASE_DIR });
    const parsed = JSON.parse(raw) as OfflineIndex;
    return {
      likedUrns: Array.isArray(parsed.likedUrns) ? parsed.likedUrns : [],
      tracksByUrn: parsed.tracksByUrn ?? {},
      updatedAt: parsed.updatedAt ?? null,
      cacheOrder: Array.isArray(parsed.cacheOrder) ? parsed.cacheOrder : [],
      collections: parsed.collections ?? {},
      pinnedUrns: Array.isArray(parsed.pinnedUrns) ? parsed.pinnedUrns : [],
    };
  } catch {
    return emptyIndex();
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

function schedulePersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }

  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (!indexCache) return;

    void ensureDir().then(() =>
      writeTextFile(INDEX_PATH, JSON.stringify(indexCache), { baseDir: BASE_DIR }).catch(() => {}),
    );
  }, 120);
}

export async function rememberTracks(tracks: Track[]) {
  if (tracks.length === 0) return;

  const index = await loadIndex();
  let changed = false;

  for (const track of tracks) {
    if (!track?.urn) continue;
    index.tracksByUrn[track.urn] = cloneTrack(track);
    changed = true;
  }

  if (changed) {
    schedulePersist();
  }
}

export async function rememberLikedTracks(tracks: Track[]) {
  const index = await loadIndex();
  for (const track of tracks) {
    if (!track?.urn) continue;
    index.tracksByUrn[track.urn] = cloneTrack(track);
  }

  index.likedUrns = tracks.map((track) => track.urn);
  index.updatedAt = Date.now();
  schedulePersist();
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
  index.cacheOrder = urns;
  schedulePersist();
}

export async function rememberPinned(urn: string) {
  const index = await loadIndex();
  if (index.pinnedUrns.includes(urn)) return;
  index.pinnedUrns = [...index.pinnedUrns, urn];
  schedulePersist();
}

export async function rememberCollection(
  scope: string,
  meta: OfflineCollectionMeta,
  tracks: Track[],
) {
  const index = await loadIndex();
  for (const track of tracks) {
    if (track?.urn) index.tracksByUrn[track.urn] = cloneTrack(track);
  }
  index.collections = {
    ...index.collections,
    [scope]: {
      ...meta,
      scope,
      trackUrns: tracks.filter((track) => track?.urn).map((track) => track.urn),
      savedAt: Date.now(),
    },
  };
  schedulePersist();
}

export async function getOfflineCollections(): Promise<OfflineCollection[]> {
  const index = await loadIndex();
  return Object.values(index.collections).sort((a, b) => b.savedAt - a.savedAt);
}

export async function getOfflineCollection(scope: string): Promise<OfflineCollection | null> {
  const index = await loadIndex();
  return index.collections[scope] ?? null;
}

export async function forgetCollection(scope: string): Promise<string[]> {
  const index = await loadIndex();
  const collection = index.collections[scope];
  if (!collection) return [];
  const { [scope]: _, ...rest } = index.collections;
  index.collections = rest;
  const kept = new Set([
    ...index.likedUrns,
    ...index.pinnedUrns,
    ...Object.values(rest).flatMap((c) => c.trackUrns),
  ]);
  schedulePersist();
  return collection.trackUrns.filter((urn) => !kept.has(urn));
}
