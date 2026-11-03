import { toast } from 'sonner';
import { create } from 'zustand';
import i18n from '../i18n';
import { noteAuthGap } from '../lib/auth-recovery';
import type { HistoryEntry } from '../lib/import-session';
import {
  backoffMs,
  errorCodeOf,
  isHalting,
  loadSyncFile,
  nextDue,
  SYNC_FIRST_TICK_MS,
  SYNC_INTERVAL_MS,
  SYNC_TICK_MS,
  type SyncEntry,
  saveSyncFile,
} from '../lib/import-sync';
import { needsToken, withToken } from '../lib/import-sync-plan';
import { append, currentOf, isGone, pull, titleOf } from '../lib/import-sync-run';
import { getIsPremium } from '../lib/premium-cache';
import { useAuthStore } from './auth';
import { isImportBusy, lastImportToken, useImportStore } from './import';

const STAGGER_MS = 17 * 60 * 1000;

interface SyncState {
  entries: SyncEntry[];
  ymToken: string | null;
  running: string | null;
  enabling: string | null;
  enable: (history: HistoryEntry, token?: string) => Promise<string | null>;
  disable: (id: string) => void;
  resume: (id: string) => void;
  syncNow: (id: string) => Promise<void>;
  reconnect: (id: string, token: string) => Promise<void>;
  disconnectYm: () => void;
  acknowledge: () => void;
  forget: (id: string) => void;
}

let started = false;
let loading: Promise<void> | null = null;

export const useImportSyncStore = create<SyncState>((set, get) => ({
  entries: [],
  ymToken: null,
  running: null,
  enabling: null,
  enable: enableEntry,
  disable: (id) => {
    patch(id, { enabled: false });
    dropTokenIfUnused();
  },
  resume: (id) => patch(id, { enabled: true, error: null, failures: 0 }),
  syncNow: (id) => runEntry(id),
  reconnect: async (id, token) => {
    useImportSyncStore.setState((state) => ({
      ymToken: token.trim(),
      entries: state.entries.map((entry) =>
        entry.error === 'ym_token_invalid'
          ? { ...entry, error: null, failures: 0, nextAt: 0 }
          : entry,
      ),
    }));
    persist();
    await runEntry(id);
  },
  disconnectYm: () => {
    set((state) => ({
      ymToken: null,
      entries: state.entries.map((entry) =>
        needsToken(entry.request) ? { ...entry, enabled: false } : entry,
      ),
    }));
    persist();
  },
  acknowledge: () => {
    if (!get().entries.some((entry) => entry.fresh > 0)) return;
    set((state) => ({ entries: state.entries.map((entry) => ({ ...entry, fresh: 0 })) }));
    persist();
  },
  forget: (id) => {
    set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) }));
    dropTokenIfUnused();
    persist();
  },
}));

function find(id: string): SyncEntry | undefined {
  return useImportSyncStore.getState().entries.find((entry) => entry.id === id);
}

function persist() {
  const { ymToken, entries } = useImportSyncStore.getState();
  void saveSyncFile({ ymToken, entries });
}

function patch(id: string, change: Partial<SyncEntry>) {
  useImportSyncStore.setState((state) => ({
    entries: state.entries.map((entry) => (entry.id === id ? { ...entry, ...change } : entry)),
  }));
  persist();
}

function dropTokenIfUnused() {
  const { entries, ymToken } = useImportSyncStore.getState();
  const used = entries.some((entry) => entry.enabled && usesYm(entry));
  if (ymToken && !used) {
    useImportSyncStore.setState({ ymToken: null });
    persist();
  }
}

function usesYm(entry: SyncEntry): boolean {
  return needsToken(entry.request) || entry.kind === 'yandex';
}

function live(entry: SyncEntry): SyncEntry {
  const token = useImportSyncStore.getState().ymToken;
  return usesYm(entry) ? { ...entry, request: withToken(entry.request, token) } : entry;
}

function ensureLoaded(): Promise<void> {
  loading ??= loadSyncFile().then((file) => {
    useImportSyncStore.setState((state) => ({
      ymToken: state.ymToken ?? file.ymToken,
      entries: [
        ...file.entries.filter((saved) => !state.entries.some((now) => now.id === saved.id)),
        ...state.entries,
      ],
    }));
  });
  return loading;
}

async function enableEntry(history: HistoryEntry, given?: string): Promise<string | null> {
  await ensureLoaded();
  const source = history.sync;
  if (!source) return null;
  const token = given?.trim() || lastImportToken() || useImportSyncStore.getState().ymToken;
  if (needsToken(source.request) && !token) return 'ym_token_invalid';
  if (find(history.id)) {
    if (token && usesYm(find(history.id) as SyncEntry)) setToken(token);
    useImportSyncStore.getState().resume(history.id);
    return null;
  }
  const base: SyncEntry = {
    id: history.id,
    title: history.title,
    kind: history.kind,
    request: source.request,
    target: source.target,
    baseTitle: history.title,
    enabled: true,
    seen: [],
    added: [],
    latest: [],
    removed: [],
    lastAt: 0,
    nextAt: 0,
    fresh: 0,
    error: null,
    failures: 0,
  };
  if (token && usesYm(base)) setToken(token);
  useImportSyncStore.setState({ enabling: history.id });
  try {
    const current = await currentOf(base);
    const baseTitle =
      source.target.mode === 'playlist' ? await titleOf(source.target.urns[0]) : history.title;
    const out = await pull(live(base), current.urns, true);
    const now = Date.now();
    const stagger =
      (useImportSyncStore.getState().entries.length * STAGGER_MS) % (SYNC_INTERVAL_MS / 2);
    const entry: SyncEntry = {
      ...base,
      baseTitle,
      seen: out.seen,
      added: source.target.mode === 'playlist' ? current.urns : [],
      lastAt: now,
      nextAt: now + SYNC_INTERVAL_MS + stagger,
    };
    useImportSyncStore.setState((state) => ({ entries: [...state.entries, entry] }));
    persist();
    return null;
  } catch (error) {
    dropTokenIfUnused();
    return errorCodeOf(error);
  } finally {
    useImportSyncStore.setState({ enabling: null });
  }
}

function setToken(token: string) {
  useImportSyncStore.setState({ ymToken: token });
  persist();
}

function addChunk(id: string, urn: string) {
  const entry = find(id);
  if (entry?.target.mode !== 'playlist') return;
  patch(id, { target: { mode: 'playlist', urns: [...entry.target.urns, urn] } });
}

async function runEntry(id: string) {
  await ensureLoaded();
  const entry = find(id);
  if (!entry || useImportSyncStore.getState().running) return;
  useImportSyncStore.setState({ running: id });
  try {
    const current = await currentOf(entry);
    const out = await pull(live(entry), current.urns, false);
    const owner = useAuthStore.getState().user?.urn ?? '';
    await append(entry, current, out.to_add, owner, (urn) => addChunk(id, urn));
    patch(id, {
      seen: out.seen,
      added: out.added,
      latest: out.to_add,
      removed: out.removed,
      lastAt: Date.now(),
      nextAt: Date.now() + SYNC_INTERVAL_MS,
      fresh: entry.fresh + out.to_add.length,
      error: null,
      failures: 0,
    });
    if (out.to_add.length > 0) {
      toast.success(
        i18n.t('importer.sync.toast', { count: out.to_add.length, title: entry.title }),
        {
          id: `import-sync-${id}`,
        },
      );
    }
  } catch (error) {
    const code = isGone(error) ? 'target_missing' : errorCodeOf(error);
    if (code === 'session_expired') noteAuthGap();
    const failures = entry.failures + 1;
    patch(id, {
      error: code,
      failures,
      nextAt: isHalting(code) ? entry.nextAt : Date.now() + backoffMs(failures),
    });
  } finally {
    useImportSyncStore.setState({ running: null });
  }
}

function tick() {
  if (!getIsPremium() || !useAuthStore.getState().hasSession) return;
  if (useImportSyncStore.getState().running || isImportBusy(useImportStore.getState())) return;
  const due = nextDue(useImportSyncStore.getState().entries, Date.now());
  if (due) void runEntry(due.id);
}

export function startImportSync() {
  if (started) return;
  started = true;
  void ensureLoaded();
  setTimeout(tick, SYNC_FIRST_TICK_MS);
  setInterval(tick, SYNC_TICK_MS);
}
