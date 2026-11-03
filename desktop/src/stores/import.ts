import { listen } from '@tauri-apps/api/event';
import { create } from 'zustand';
import i18n from '../i18n';
import { ApiError, getSessionId } from '../lib/api';
import { preferredDataBase } from '../lib/api-client';
import { noteAuthGap } from '../lib/auth-recovery';
import { trackedInvoke as invoke } from '../lib/diagnostics';
import {
  addToPlaylist,
  type ImportPendingCreate,
  type ImportPendingState,
  isPlaylistConflict,
  likeTracks,
  pendingStateOf,
  type ScPlaylist,
  saveChunks,
} from '../lib/import-save';
import {
  addHistory,
  clearSession,
  type DestinationMode,
  type HistoryEntry,
  type ImportDestination,
  type ImportKind,
  type ImportRequest,
  type ImportRow,
  loadHistory,
  loadSession,
  removeHistory,
  rerunnable,
  saveSession,
  type TrackMap,
} from '../lib/import-session';
import { queryClient } from '../lib/query-client';
import { fetchTracksByUrns } from '../lib/soundwave';
import { useAuthStore } from './auth';
import type { Track } from './player';
import { useSettingsStore } from './settings';

export type { DestinationMode, ImportDestination, ImportKind, ImportRequest, ImportRow };

const LIKES_TITLE = 'Yandex Music';
const MAX_TITLE_LENGTH = 100;
const DETAILS_BATCH = 100;

export interface ImportProgress {
  stage: 'reading' | 'matching';
  title: string;
  total: number;
  current: number;
  found: number;
  not_found: number;
  errors: number;
  partial: boolean;
}

interface ImportChunk {
  rows: ImportRow[];
}

export type ImportPhase = 'idle' | 'running' | 'stopping' | 'review' | 'saving' | 'done' | 'error';

export type ImportStage = 'reading' | 'matching' | 'review' | 'saving' | 'done';

export interface ImportFailure {
  code: string;
  status?: number;
}

export interface ImportPrefill {
  tab: 'yandex' | 'link' | 'text';
  value: string;
}

export interface ImportResult {
  playlist: ScPlaylist | null;
  mode: ImportDestination['mode'];
  count: number;
  pendingState: ImportPendingState | null;
  pendingCreates: ImportPendingCreate[];
  savedAt: number;
}

interface ImportState {
  phase: ImportPhase;
  kind: ImportKind | null;
  title: string;
  progress: ImportProgress | null;
  startedAt: number;
  rows: ImportRow[];
  tracks: TrackMap;
  destination: ImportDestination;
  saveDone: number;
  saveTotal: number;
  result: ImportResult | null;
  failure: ImportFailure | null;
  history: HistoryEntry[];
  dialogOpen: boolean;
  prefill: ImportPrefill | null;
  initBridge: () => void;
  openDialog: (prefill?: ImportPrefill) => void;
  closeDialog: () => void;
  startImport: (request: ImportRequest) => Promise<void>;
  retry: () => void;
  stopImport: () => Promise<void>;
  setDestination: (patch: Partial<ImportDestination>) => void;
  setMatch: (position: number, track: Track | null) => void;
  saveImport: () => Promise<void>;
  discard: () => void;
  forgetHistory: (id: string) => void;
}

const emptyDestination: ImportDestination = { mode: 'create', name: '', playlistUrn: null };

const idleState = {
  phase: 'idle' as ImportPhase,
  kind: null,
  title: '',
  progress: null,
  startedAt: 0,
  rows: [] as ImportRow[],
  tracks: {} as TrackMap,
  destination: emptyDestination,
  saveDone: 0,
  saveTotal: 0,
  result: null,
  failure: null,
  prefill: null,
};

let bridgeInitialized = false;
let activeRunId = 0;
let stopRequested = false;
let lastRequest: ImportRequest | null = null;
let incoming: ImportRow[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function kindOf(request: ImportRequest, detected: string | null): ImportKind {
  if (request.kind === 'link') return (detected as ImportKind | null) ?? 'text';
  return request.kind;
}

function ordered(rows: ImportRow[]): ImportRow[] {
  return [...rows].sort((a, b) => a.position - b.position);
}

function matchedUrns(rows: ImportRow[], kind: ImportKind | null): string[] {
  const urns = ordered(rows)
    .map((row) => row.urn)
    .filter((urn): urn is string => urn != null);
  const unique = [...new Set(urns)];
  const oldestFirst = kind === 'ym_likes' && useSettingsStore.getState().ymImportOrder === 'oldest';
  return oldestFirst ? unique.reverse() : unique;
}

function defaultName(kind: ImportKind | null, title: string): string {
  if (kind === 'ym_likes') return LIKES_TITLE;
  return (title.trim() || i18n.t('importer.defaultTitle')).slice(0, MAX_TITLE_LENGTH);
}

async function loadDetails(urns: string[]) {
  const known = useImportStore.getState().tracks;
  const missing = [...new Set(urns)].filter((urn) => !known[urn]);
  for (let i = 0; i < missing.length; i += DETAILS_BATCH) {
    const found = await fetchTracksByUrns(missing.slice(i, i + DETAILS_BATCH));
    useImportStore.setState((state) => ({
      tracks: { ...state.tracks, ...Object.fromEntries(found.map((track) => [track.urn, track])) },
    }));
  }
}

function flushIncoming() {
  flushTimer = null;
  const batch = incoming;
  incoming = [];
  if (batch.length === 0) return;
  useImportStore.setState((state) => ({ rows: [...state.rows, ...batch] }));
  void loadDetails(batch.map((row) => row.urn).filter((urn): urn is string => urn != null));
}

function persistSoon() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const { kind, title, rows, destination, progress, phase } = useImportStore.getState();
    if (phase !== 'review' || !kind) return;
    void saveSession({
      kind,
      title,
      rows,
      destination,
      total: progress?.total ?? rows.length,
      at: Date.now(),
    });
  }, 400);
}

function failureOf(error: unknown): ImportFailure {
  if (typeof error === 'string') return { code: error };
  if (isPlaylistConflict(error)) return { code: 'playlist_not_synced' };
  if (error instanceof ApiError) return { code: 'save_failed', status: error.status };
  return { code: 'unknown' };
}

async function runImport(runId: number, request: ImportRequest) {
  let failure: unknown = null;
  try {
    await invoke<void>('import_start', {
      request,
      backendUrl: preferredDataBase(),
      sessionId: getSessionId() || '',
    });
  } catch (error) {
    failure = error;
  }
  if (runId !== activeRunId) return;
  if (flushTimer) clearTimeout(flushTimer);
  flushIncoming();

  const state = useImportStore.getState();
  const title = state.progress?.title ?? '';
  if (failure === 'session_expired') noteAuthGap();
  if (state.rows.length === 0) {
    useImportStore.setState({
      phase: failure ? 'error' : 'idle',
      failure: failure ? failureOf(failure) : null,
    });
    return;
  }
  useImportStore.setState({
    phase: 'review',
    title,
    failure: failure ? failureOf(failure) : null,
    destination: { ...state.destination, name: defaultName(state.kind, title) },
  });
  persistSoon();
}

async function startImportRun(request: ImportRequest) {
  const state = useImportStore.getState();
  if (state.phase !== 'idle' && state.phase !== 'error') return;

  state.initBridge();
  activeRunId += 1;
  const runId = activeRunId;
  stopRequested = false;
  lastRequest = request;
  incoming = [];
  void clearSession();

  const detected =
    request.kind === 'link'
      ? await invoke<string | null>('import_detect', { input: request.url }).catch(() => null)
      : null;
  useImportStore.setState({
    ...idleState,
    phase: 'running',
    kind: kindOf(request, detected),
    startedAt: Date.now(),
    prefill: null,
  });

  await runImport(runId, request);
}

async function writeDestination(runId: number): Promise<ImportResult | null> {
  const { rows, kind, destination, tracks } = useImportStore.getState();
  const urns = matchedUrns(rows, kind);
  const isActive = () => runId === activeRunId;
  const onStep = (saveDone: number) => useImportStore.setState({ saveDone });
  useImportStore.setState({ saveDone: 0, saveTotal: urns.length });

  if (destination.mode === 'likes') {
    await loadDetails(urns);
    const loaded = useImportStore.getState().tracks;
    await likeTracks(
      urns.map((urn) => loaded[urn] ?? tracks[urn]).filter(Boolean),
      onStep,
      isActive,
    );
    return {
      playlist: null,
      mode: 'likes',
      count: urns.length,
      pendingState: null,
      pendingCreates: [],
      savedAt: Date.now(),
    };
  }

  if (destination.mode === 'existing' && destination.playlistUrn) {
    await addToPlaylist(destination.playlistUrn, urns, onStep, isActive);
    return {
      playlist: null,
      mode: 'existing',
      count: urns.length,
      pendingState: null,
      pendingCreates: [],
      savedAt: Date.now(),
    };
  }

  const name = destination.name.trim().slice(0, MAX_TITLE_LENGTH) || defaultName(kind, '');
  const saved = await saveChunks({
    baseTitle: name,
    likes: kind === 'ym_likes' && name === LIKES_TITLE,
    owner: useAuthStore.getState().user?.urn ?? '',
    urns,
    deleteStale: !stopRequested,
    isActive,
  });
  if (!saved) return null;
  queryClient.invalidateQueries({ queryKey: ['me', 'playlists'] }).catch(() => undefined);
  if (saved.failure) throw saved.failure;
  return {
    playlist: saved.saved[0] ?? null,
    mode: 'create',
    count: urns.length,
    pendingState: pendingStateOf(saved.waiting, saved.needsRelogin),
    pendingCreates: saved.waiting,
    savedAt: Date.now(),
  };
}

async function saveRun() {
  const state = useImportStore.getState();
  if (state.phase !== 'review') return;
  const runId = activeRunId;
  useImportStore.setState({ phase: 'saving', failure: null });
  try {
    const result = await writeDestination(runId);
    if (!result || runId !== activeRunId) return;
    const found = state.rows.filter((row) => row.urn).length;
    const history = await addHistory({
      id: `${Date.now()}`,
      at: Date.now(),
      kind: state.kind ?? 'text',
      title: state.destination.name || state.title,
      total: state.rows.length,
      found,
      request: lastRequest ? rerunnable(lastRequest) : null,
      playlistUrn: result.playlist?.urn ?? null,
    });
    void clearSession();
    useImportStore.setState({ phase: 'done', result, history });
  } catch (error) {
    useImportStore.setState({ phase: 'review', failure: failureOf(error) });
  }
}

function ensureBridge() {
  if (bridgeInitialized) return;
  bridgeInitialized = true;

  void listen<ImportProgress>('import:progress', (event) => {
    useImportStore.setState({ progress: event.payload });
  });

  void listen<ImportChunk>('import:chunk', (event) => {
    incoming.push(...event.payload.rows);
    flushTimer ??= setTimeout(flushIncoming, 120);
  });

  void loadHistory().then((history) => useImportStore.setState({ history }));
  void loadSession().then((session) => {
    if (!session || useImportStore.getState().phase !== 'idle') return;
    useImportStore.setState({
      phase: 'review',
      kind: session.kind,
      title: session.title,
      rows: session.rows,
      destination: session.destination,
      progress: {
        stage: 'matching',
        title: session.title,
        total: session.total,
        current: session.rows.length,
        found: session.rows.filter((row) => row.urn).length,
        not_found: session.rows.filter((row) => !row.urn).length,
        errors: 0,
        partial: false,
      },
    });
    void loadDetails(
      session.rows.map((row) => row.urn).filter((urn): urn is string => urn != null),
    );
  });
}

export const useImportStore = create<ImportState>((set, get) => ({
  ...idleState,
  history: [],
  dialogOpen: false,
  initBridge: ensureBridge,
  openDialog: (prefill) => set({ dialogOpen: true, prefill: prefill ?? get().prefill }),
  closeDialog: () => set({ dialogOpen: false }),
  startImport: startImportRun,
  retry: () => {
    const request = lastRequest;
    if (!request) return;
    set({ phase: 'idle', failure: null });
    void startImportRun(request);
  },
  stopImport: async () => {
    if (get().phase !== 'running') return;
    stopRequested = true;
    set({ phase: 'stopping' });
    try {
      await invoke('import_stop');
    } catch (error) {
      console.error('[Import] stop failed:', error);
    }
  },
  setDestination: (patch) => {
    set((state) => ({ destination: { ...state.destination, ...patch } }));
    persistSoon();
  },
  setMatch: (position, track) => {
    set((state) => ({
      rows: state.rows.map((row) =>
        row.position === position ? { ...row, urn: track?.urn ?? null } : row,
      ),
      tracks: track ? { ...state.tracks, [track.urn]: track } : state.tracks,
    }));
    persistSoon();
  },
  saveImport: saveRun,
  discard: () => {
    activeRunId += 1;
    void clearSession();
    set({ ...idleState, dialogOpen: get().dialogOpen });
  },
  forgetHistory: (id) => {
    void removeHistory(id).then((history) => set({ history }));
  },
}));

export function isImportBusy(state: Pick<ImportState, 'phase'>) {
  return state.phase === 'running' || state.phase === 'stopping' || state.phase === 'saving';
}

export function importStageOf(state: Pick<ImportState, 'phase' | 'progress'>): ImportStage | null {
  switch (state.phase) {
    case 'running':
    case 'stopping':
      return state.progress?.stage ?? 'reading';
    case 'review':
      return 'review';
    case 'saving':
      return 'saving';
    case 'done':
      return 'done';
    default:
      return null;
  }
}
