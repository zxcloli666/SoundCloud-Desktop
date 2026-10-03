import { listen } from '@tauri-apps/api/event';
import { create } from 'zustand';
import { api, getSessionId } from '../lib/api';
import { API_BASE } from '../lib/constants';
import { trackedInvoke as invoke } from '../lib/diagnostics';
import { queryClient } from '../lib/query-client';

const PLAYLIST_NAME = 'Yandex Music';
const PLAYLIST_TRACK_LIMIT = 500;

export interface YmImportProgress {
  total: number;
  current: number;
  found: number;
  not_found: number;
  errors: number;
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
  status: 'queued';
  actionType: string;
  targetUrn: string;
}

interface PlaylistTracksPage {
  sync: { projectionRevision: number };
}

type YmImportPhase = 'idle' | 'running' | 'stopping' | 'done' | 'stopped' | 'error';

interface YmImportState {
  phase: YmImportPhase;
  saving: boolean;
  progress: YmImportProgress | null;
  playlist: ScPlaylist | null;
  playlistCount: number;
  pending: boolean;
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
  pending: false,
  error: null,
};

let bridgeInitialized = false;
let activeRunId = 0;
let stopRequested = false;
let matchedUrns: string[] = [];

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

function resetRuntimeState() {
  stopRequested = false;
  matchedUrns = [];
}

async function findExistingPlaylists(): Promise<ScPlaylist[]> {
  const all: ScPlaylist[] = [];

  for (let page = 0; ; page++) {
    const res = await api<{ collection: ScPlaylist[]; has_more: boolean }>(
      `/me/playlists?limit=200&page=${page}`,
    );
    all.push(...(res.collection ?? []));
    if (!res.has_more) break;
  }

  return all.filter((playlist) => getPlaylistChunkIndex(playlist.title) != null);
}

async function replacePlaylistTracks(playlistUrn: string, urns: string[]) {
  const path = `/playlists/${encodeURIComponent(playlistUrn)}`;
  const { sync } = await api<PlaylistTracksPage>(`${path}/tracks?limit=1&page=0`);

  await api(`${path}?replace=true`, {
    method: 'PUT',
    body: JSON.stringify({
      playlist: { tracks: urns.map((urn) => ({ urn })) },
      expectedProjectionRevision: sync.projectionRevision,
    }),
  });
}

async function saveChunk(
  index: number,
  urns: string[],
  existing: ScPlaylist[],
): Promise<ScPlaylist | null> {
  const title = getPlaylistName(index);
  const existingPlaylist = existing.find((playlist) => playlist.title === title);

  if (existingPlaylist) {
    await replacePlaylistTracks(existingPlaylist.urn, urns);
    return existingPlaylist;
  }

  const result = await api<ScPlaylist | QueuedPlaylistMutation>('/playlists', {
    method: 'POST',
    body: JSON.stringify({
      playlist: {
        title,
        sharing: 'private',
        tracks: urns.map((urn) => ({ urn })),
      },
    }),
  });

  return isScPlaylist(result) ? result : null;
}

async function deleteStalePlaylists(existing: ScPlaylist[], targetCount: number) {
  const stalePlaylists = existing.filter((playlist) => {
    const index = getPlaylistChunkIndex(playlist.title);
    return index != null && index >= targetCount;
  });

  await Promise.all(
    stalePlaylists.map((playlist) =>
      api(`/playlists/${encodeURIComponent(playlist.urn)}`, { method: 'DELETE' }).catch(
        () => undefined,
      ),
    ),
  );
}

async function savePlaylists(runId: number, deleteStale: boolean) {
  if (matchedUrns.length === 0) return;

  useYmImportStore.setState({ saving: true, error: null });

  const existing = await findExistingPlaylists();
  if (!currentRunIsActive(runId)) return;

  const chunks = chunkArray([...matchedUrns].reverse(), PLAYLIST_TRACK_LIMIT);
  const saved: ScPlaylist[] = [];
  let queued = 0;

  for (const [index, urns] of chunks.entries()) {
    const playlist = await saveChunk(index, urns, existing);
    if (!currentRunIsActive(runId)) return;

    if (playlist) {
      saved.push(playlist);
    } else {
      queued++;
    }
  }

  if (deleteStale) {
    await deleteStalePlaylists(existing, chunks.length);
    if (!currentRunIsActive(runId)) return;
  }

  const primaryPlaylist = saved[0] ?? null;
  useYmImportStore.setState({
    playlist: primaryPlaylist,
    playlistCount: chunks.length,
    pending: queued > 0,
  });

  queryClient.invalidateQueries({ queryKey: ['me', 'playlists'] }).catch(() => undefined);
  if (primaryPlaylist) {
    queryClient
      .invalidateQueries({ queryKey: ['playlist', primaryPlaylist.urn] })
      .catch(() => undefined);
    queryClient
      .invalidateQueries({ queryKey: ['playlist', primaryPlaylist.urn, 'tracks'] })
      .catch(() => undefined);
  }
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
    let failure: unknown = null;
    try {
      await invoke<void>('ym_import_start', {
        ymToken: trimmedToken,
        backendUrl: API_BASE,
        sessionId: getSessionId() || '',
      });
    } catch (error) {
      failure = error;
    }

    if (!currentRunIsActive(runId)) return;

    const wasStopped = stopRequested;
    await savePlaylists(runId, !wasStopped && !failure);

    if (!currentRunIsActive(runId)) return;
    if (failure) throw failure;

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
    matchedUrns.push(event.payload.urn);
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
