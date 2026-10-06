import { listen } from '@tauri-apps/api/event';
import { create } from 'zustand';
import { api, getSessionId } from '../lib/api';
import { API_BASE } from '../lib/constants';
import { trackedInvoke as invoke } from '../lib/diagnostics';
import { queryClient } from '../lib/query-client';

const PLAYLIST_NAME = 'Yandex Music';
const PLAYLIST_TRACK_LIMIT = 500;
const SAVE_DEBOUNCE_MS = 450;
const SAVE_BATCH_SIZE = 20;

export interface YmImportProgress {
  total: number;
  current: number;
  found: number;
  not_found: number;
  current_track: string;
}

interface YmImportMatch {
  urn: string;
}

interface ScPlaylist {
  urn: string;
  title: string;
  track_count: number;
  artwork_url: string | null;
  permalink_url: string;
  user: { username: string };
}

interface QueuedPlaylistMutation {
  queued: true;
  actionType: string;
  targetUrn?: string;
}

type YmImportPhase = 'idle' | 'running' | 'stopping' | 'done' | 'stopped' | 'error';

interface YmImportState {
  phase: YmImportPhase;
  saving: boolean;
  progress: YmImportProgress | null;
  playlist: ScPlaylist | null;
  playlistCount: number;
  error: string | null;
  initBridge: () => void;
  startImport: (token: string) => Promise<void>;
  stopImport: () => Promise<void>;
  clearFinished: () => void;
}

const idleState = {
  phase: 'idle' as YmImportPhase,
  saving: false,
  progress: null,
  playlist: null,
  playlistCount: 0,
  error: null,
};

let bridgeInitialized = false;
let activeRunId = 0;
let stopRequested = false;
let matchedUrns: string[] = [];
let cachedPlaylists: ScPlaylist[] | null = null;
let syncedChunkKeys: string[] = [];
let syncedMatchCount = 0;
let syncTimer: number | null = null;
let syncInFlight = false;
let syncQueued = false;
let queuedFinalize = false;
let queuedDeleteStale = false;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function getPlaylistName(index: number): string {
  return index === 0 ? PLAYLIST_NAME : `${PLAYLIST_NAME} ${index + 1}`;
}

function getPlaylistChunkIndex(title: string): number | null {
  if (title === PLAYLIST_NAME) return 0;
  const match = /^Yandex Music (\d+)$/.exec(title);
  if (!match) return null;
  const parsed = Number.parseInt(match[1] ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 2 ? parsed - 1 : null;
}

function isScPlaylist(value: unknown): value is ScPlaylist {
  if (!value || typeof value !== 'object') return false;
  return (
    typeof (value as ScPlaylist).urn === 'string' && typeof (value as ScPlaylist).title === 'string'
  );
}

function currentRunIsActive(runId: number) {
  return runId === activeRunId;
}

function clearSyncTimer() {
  if (syncTimer != null) {
    window.clearTimeout(syncTimer);
    syncTimer = null;
  }
}

function resetRuntimeState() {
  clearSyncTimer();
  stopRequested = false;
  matchedUrns = [];
  cachedPlaylists = null;
  syncedChunkKeys = [];
  syncedMatchCount = 0;
  syncInFlight = false;
  syncQueued = false;
  queuedFinalize = false;
  queuedDeleteStale = false;
}

async function findExistingPlaylists(): Promise<ScPlaylist[]> {
  try {
    const all: ScPlaylist[] = [];

    for (let page = 0; ; page++) {
      const res = await api<{ collection: ScPlaylist[]; has_more: boolean }>(
        `/me/playlists?limit=200&page=${page}`,
      );
      all.push(...(res.collection ?? []));
      if (!res.has_more) break;
    }

    return all
      .filter((playlist) => getPlaylistChunkIndex(playlist.title) != null)
      .sort(
        (a, b) => (getPlaylistChunkIndex(a.title) ?? 0) - (getPlaylistChunkIndex(b.title) ?? 0),
      );
  } catch {
    return [];
  }
}

async function upsertPlaylistChunk(index: number, urns: string[]): Promise<ScPlaylist | null> {
  const title = getPlaylistName(index);
  const trackObjects = urns.map((urn) => ({ urn }));
  const existingPlaylist = cachedPlaylists?.find((playlist) => playlist.title === title) ?? null;

  if (existingPlaylist) {
    const result = await api<ScPlaylist | QueuedPlaylistMutation>(
      `/playlists/${encodeURIComponent(existingPlaylist.urn)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ playlist: { tracks: trackObjects } }),
      },
    );
    return isScPlaylist(result) ? result : existingPlaylist;
  }

  const result = await api<ScPlaylist | QueuedPlaylistMutation>('/playlists', {
    method: 'POST',
    body: JSON.stringify({
      playlist: {
        title,
        sharing: 'private',
        tracks: trackObjects,
      },
    }),
  });

  if (isScPlaylist(result)) {
    return result;
  }

  const refreshed = await findExistingPlaylists();
  cachedPlaylists = refreshed;
  return refreshed.find((playlist) => playlist.title === title) ?? null;
}

async function deleteStalePlaylists(targetCount: number) {
  const stalePlaylists = (cachedPlaylists ?? []).filter((playlist) => {
    const index = getPlaylistChunkIndex(playlist.title);
    return index != null && index >= targetCount;
  });

  if (stalePlaylists.length === 0) {
    return;
  }

  await Promise.all(
    stalePlaylists.map((playlist) =>
      api(`/playlists/${encodeURIComponent(playlist.urn)}`, { method: 'DELETE' }).catch(
        () => undefined,
      ),
    ),
  );

  cachedPlaylists = (cachedPlaylists ?? []).filter(
    (playlist) => !stalePlaylists.includes(playlist),
  );
}

async function flushPlaylistSync(
  runId: number,
  finalize = false,
  deleteStale = false,
): Promise<void> {
  if (!currentRunIsActive(runId)) return;

  if (syncInFlight) {
    syncQueued = true;
    queuedFinalize ||= finalize;
    queuedDeleteStale ||= deleteStale;
    return;
  }

  clearSyncTimer();
  syncInFlight = true;
  useYmImportStore.setState({ saving: true, error: null });

  try {
    if (!cachedPlaylists) {
      cachedPlaylists = await findExistingPlaylists();
      if (!currentRunIsActive(runId)) return;
    }

    const orderedUrns = [...matchedUrns].reverse();
    const chunks = chunkArray(orderedUrns, PLAYLIST_TRACK_LIMIT);
    const chunkKeys = chunks.map((chunk) => chunk.join('\u0000'));
    const nextPlaylists = [...(cachedPlaylists ?? [])];
    let changed = false;

    for (let index = 0; index < chunks.length; index++) {
      if (!currentRunIsActive(runId)) return;

      if (!finalize && chunkKeys[index] === syncedChunkKeys[index]) {
        continue;
      }

      const updated = await upsertPlaylistChunk(index, chunks[index] ?? []);
      if (!currentRunIsActive(runId)) return;

      if (!updated) {
        continue;
      }

      const existingIndex = nextPlaylists.findIndex((playlist) => playlist.title === updated.title);
      if (existingIndex >= 0) {
        nextPlaylists[existingIndex] = updated;
      } else {
        nextPlaylists.push(updated);
      }
      changed = true;
    }

    cachedPlaylists = nextPlaylists
      .filter((playlist) => getPlaylistChunkIndex(playlist.title) != null)
      .sort(
        (a, b) => (getPlaylistChunkIndex(a.title) ?? 0) - (getPlaylistChunkIndex(b.title) ?? 0),
      );

    if (deleteStale && matchedUrns.length > 0) {
      await deleteStalePlaylists(chunks.length);
      if (!currentRunIsActive(runId)) return;
    }

    syncedChunkKeys = chunkKeys;
    syncedMatchCount = matchedUrns.length;

    const primaryPlaylist = cachedPlaylists[0] ?? null;
    useYmImportStore.setState({
      playlist: primaryPlaylist,
      playlistCount: chunks.length,
    });

    if (changed || deleteStale) {
      queryClient.invalidateQueries({ queryKey: ['me', 'playlists'] }).catch(() => undefined);
      if (primaryPlaylist?.urn) {
        queryClient
          .invalidateQueries({ queryKey: ['playlist', primaryPlaylist.urn] })
          .catch(() => undefined);
        queryClient
          .invalidateQueries({
            queryKey: ['playlist', primaryPlaylist.urn, 'tracks'],
          })
          .catch(() => undefined);
      }
    }
  } catch (error) {
    console.error('[YM Import] playlist sync failed:', error);
    useYmImportStore.setState({
      error: error instanceof Error ? error.message : String(error),
    });
    if (finalize) {
      throw error;
    }
  } finally {
    syncInFlight = false;

    if (!currentRunIsActive(runId)) {
      return;
    }

    if (syncQueued) {
      const nextFinalize = queuedFinalize;
      const nextDeleteStale = queuedDeleteStale;
      syncQueued = false;
      queuedFinalize = false;
      queuedDeleteStale = false;
      await flushPlaylistSync(runId, nextFinalize, nextDeleteStale);
      return;
    }

    const { phase } = useYmImportStore.getState();
    useYmImportStore.setState({
      saving: phase === 'running' || phase === 'stopping',
    });
  }
}

function schedulePlaylistSync(runId: number) {
  if (!currentRunIsActive(runId)) return;

  clearSyncTimer();
  const pendingMatches = matchedUrns.length - syncedMatchCount;
  const crossedChunkBoundary =
    matchedUrns.length === 1 || matchedUrns.length % PLAYLIST_TRACK_LIMIT === 1;
  const delay = crossedChunkBoundary || pendingMatches >= SAVE_BATCH_SIZE ? 0 : SAVE_DEBOUNCE_MS;

  syncTimer = window.setTimeout(() => {
    syncTimer = null;
    void flushPlaylistSync(runId);
  }, delay);
}

async function startImportRun(token: string) {
  const trimmedToken = token.trim();
  if (!trimmedToken) return;

  const state = useYmImportStore.getState();
  if (state.phase === 'running' || state.phase === 'stopping' || state.saving) {
    return;
  }

  state.initBridge();
  activeRunId += 1;
  const runId = activeRunId;
  resetRuntimeState();

  useYmImportStore.setState({
    ...idleState,
    phase: 'running',
  });

  try {
    await invoke<void>('ym_import_start', {
      ymToken: trimmedToken,
      backendUrl: API_BASE,
      sessionId: getSessionId() || '',
    });

    if (!currentRunIsActive(runId)) return;

    const wasStopped = stopRequested;
    await flushPlaylistSync(runId, true, !wasStopped);

    if (!currentRunIsActive(runId)) return;

    useYmImportStore.setState({
      phase: wasStopped ? 'stopped' : 'done',
      saving: false,
    });
  } catch (error) {
    if (!currentRunIsActive(runId)) return;
    console.error('[YM Import]', error);
    useYmImportStore.setState({
      phase: 'error',
      saving: false,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (currentRunIsActive(runId)) {
      stopRequested = false;
      clearSyncTimer();
    }
  }
}

function ensureBridge() {
  if (bridgeInitialized) return;
  bridgeInitialized = true;

  void listen<YmImportProgress>('ym_import:progress', (event) => {
    useYmImportStore.setState({ progress: event.payload });
  });

  void listen<YmImportMatch>('ym_import:match', (event) => {
    const runId = activeRunId;
    if (!currentRunIsActive(runId)) return;
    matchedUrns.push(event.payload.urn);
    schedulePlaylistSync(runId);
  });
}

export const useYmImportStore = create<YmImportState>((set, get) => ({
  ...idleState,
  initBridge: ensureBridge,
  startImport: startImportRun,
  stopImport: async () => {
    const { phase } = get();
    if (phase !== 'running') return;
    stopRequested = true;
    set({ phase: 'stopping' });
    try {
      await invoke('ym_import_stop');
    } catch (error) {
      console.error('[YM Import] stop failed:', error);
    }
  },
  clearFinished: () => {
    const { phase, saving } = get();
    if (phase === 'running' || phase === 'stopping' || saving) {
      return;
    }
    set(idleState);
  },
}));

export function isYmImportBusy(state: Pick<YmImportState, 'phase' | 'saving'>) {
  return state.phase === 'running' || state.phase === 'stopping' || state.saving;
}
