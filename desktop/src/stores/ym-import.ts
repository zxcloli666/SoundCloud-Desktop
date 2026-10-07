import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import { create } from 'zustand';
import i18n from '../i18n';
import { ApiError, api, getSessionId } from '../lib/api';
import { preferredDataBase } from '../lib/api-client';
import { noteAuthGap } from '../lib/auth-recovery';
import { trackedInvoke as invoke } from '../lib/diagnostics';
import { queryClient } from '../lib/query-client';
import {
  forgetOwnedPlaylists,
  loadOwnedPlaylists,
  rememberOwnedPlaylists,
} from '../lib/ym-owned-playlists';
import { loadPendingCreates, rememberPendingCreate } from '../lib/ym-pending-playlists';
import { useAuthStore } from './auth';

const PLAYLIST_NAME = 'Yandex Music';
const PLAYLIST_TRACK_LIMIT = 500;
const PLAYLIST_CONFLICT_RETRIES = 3;
const PLAYLIST_CONFLICT_PAUSE_SEC = 5;
const NATIVE_FAILURES = new Map([
  ['session_expired', 'ym.sessionExpired'],
  ['ym_token_invalid', 'ym.tokenInvalid'],
  ['ym_unavailable', 'ym.ymUnavailable'],
  ['search_unavailable', 'ym.searchUnavailable'],
]);

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
  position: number;
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
let matches: YmImportMatch[] = [];

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
  matches = [];
}

function orderedUrns(): string[] {
  const newestFirst = [...matches].sort((a, b) => a.position - b.position).map((m) => m.urn);
  return [...new Set(newestFirst)];
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPlaylistConflict(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 409;
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

  for (let retry = 0; ; retry++) {
    const { sync } = await api<PlaylistTracksPage>(`${path}/tracks?limit=1&page=0`);
    try {
      await api(`${path}?replace=true`, {
        method: 'PUT',
        silentStatuses: [409],
        body: JSON.stringify({
          playlist: { tracks: urns.map((urn) => ({ urn })) },
          expectedProjectionRevision: sync.projectionRevision,
        }),
      });
      return;
    } catch (error) {
      if (!isPlaylistConflict(error) || retry >= PLAYLIST_CONFLICT_RETRIES) throw error;
      await wait((error.retryAfterSeconds ?? PLAYLIST_CONFLICT_PAUSE_SEC) * 1000);
    }
  }
}

function createPlaylist(title: string, urns: string[]) {
  return api<ScPlaylist | QueuedPlaylistMutation>('/playlists', {
    method: 'POST',
    body: JSON.stringify({
      playlist: {
        title,
        sharing: 'private',
        tracks: urns.map((urn) => ({ urn })),
      },
    }),
  });
}

async function deleteStalePlaylists(owner: string, existing: ScPlaylist[], targetCount: number) {
  const owned = await loadOwnedPlaylists(owner);
  const stalePlaylists = existing.filter((playlist) => {
    const index = getPlaylistChunkIndex(playlist.title);
    return index != null && index >= targetCount && owned.has(playlist.urn);
  });

  const deleted = await Promise.all(
    stalePlaylists.map((playlist) =>
      api(`/playlists/${encodeURIComponent(playlist.urn)}`, { method: 'DELETE' }).then(
        () => playlist.urn,
        () => null,
      ),
    ),
  );
  await forgetOwnedPlaylists(
    owner,
    deleted.filter((urn): urn is string => urn != null),
  );
}

async function savePlaylists(runId: number, deleteStale: boolean) {
  if (matches.length === 0) return;

  useYmImportStore.setState({ saving: true, error: null });

  const existing = await findExistingPlaylists();
  const owner = useAuthStore.getState().user?.urn ?? '';
  const pending = await loadPendingCreates(owner, existing);
  await rememberOwnedPlaylists(owner, pending.createdUrns);
  if (!currentRunIsActive(runId)) return;

  const chunks = chunkArray(orderedUrns(), PLAYLIST_TRACK_LIMIT);
  const saved: ScPlaylist[] = [];
  let queued = 0;
  let failure: unknown = null;

  for (const [index, urns] of chunks.entries()) {
    const title = getPlaylistName(index);
    if (pending.titles.has(title)) {
      queued++;
      continue;
    }
    const existingPlaylist = existing.find((playlist) => playlist.title === title);
    try {
      if (existingPlaylist) {
        await replacePlaylistTracks(existingPlaylist.urn, urns);
        saved.push(existingPlaylist);
      } else {
        const result = await createPlaylist(title, urns);
        if (isScPlaylist(result)) {
          saved.push(result);
          await rememberOwnedPlaylists(owner, [result.urn]);
        } else {
          queued++;
          await rememberPendingCreate(owner, title);
        }
      }
    } catch (error) {
      console.error(`[YM Import] saving "${title}" failed:`, error);
      failure ??= error;
    }
    if (!currentRunIsActive(runId)) return;
  }

  if (deleteStale && !failure) {
    await deleteStalePlaylists(owner, existing, chunks.length);
    if (!currentRunIsActive(runId)) return;
  }

  const primaryPlaylist = saved[0] ?? null;
  useYmImportStore.setState({
    playlist: primaryPlaylist,
    playlistCount: saved.length + queued,
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

  if (failure) throw failure;
}

function describeFailure(error: unknown): string {
  const nativeKey = typeof error === 'string' ? NATIVE_FAILURES.get(error) : undefined;
  if (nativeKey) return i18n.t(nativeKey);
  if (isPlaylistConflict(error)) return i18n.t('ym.playlistNotSynced');
  if (error instanceof ApiError) return i18n.t('ym.saveFailed', { status: error.status });
  return i18n.t('ym.unknownError');
}

function reportFailure(error: unknown) {
  console.error('[YM Import]', error);
  if (error === 'session_expired') noteAuthGap();
  const message = describeFailure(error);
  useYmImportStore.setState({ phase: 'error', saving: false, error: message });
  toast.error(i18n.t('ym.error'), { id: 'ym-import-error', description: message });
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

  let failure: unknown = null;
  try {
    await invoke<void>('ym_import_start', {
      ymToken: trimmedToken,
      backendUrl: preferredDataBase(),
      sessionId: getSessionId() || '',
    });
  } catch (error) {
    failure = error;
  }
  if (!currentRunIsActive(runId)) return;

  const wasStopped = stopRequested;
  const searchErrors = useYmImportStore.getState().progress?.errors ?? 0;
  try {
    await savePlaylists(runId, !wasStopped && !failure && searchErrors === 0);
  } catch (error) {
    failure ??= error;
  }
  if (!currentRunIsActive(runId)) return;
  stopRequested = false;

  if (failure) {
    reportFailure(failure);
    return;
  }
  useYmImportStore.setState({
    phase: wasStopped ? 'stopped' : 'done',
    saving: false,
  });
}

function ensureBridge() {
  if (bridgeInitialized) return;
  bridgeInitialized = true;

  void listen<YmImportProgress>('ym_import:progress', (event) => {
    useYmImportStore.setState({ progress: event.payload });
  });

  void listen<YmImportMatch>('ym_import:match', (event) => {
    matches.push(event.payload);
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
