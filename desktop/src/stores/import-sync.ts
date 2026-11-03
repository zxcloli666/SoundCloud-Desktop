import { toast } from 'sonner';
import { create } from 'zustand';
import i18n from '../i18n';
import { noteAuthGap } from '../lib/auth-recovery';
import type { HistoryEntry } from '../lib/import-session';
import {
  backoffMs,
  errorCodeOf,
  isHalting,
  loadSyncEntries,
  nextDue,
  SYNC_FIRST_TICK_MS,
  SYNC_INTERVAL_MS,
  SYNC_TICK_MS,
  type SyncEntry,
  saveSyncEntries,
  withToken,
} from '../lib/import-sync';
import { append, currentUrns, pull, roomFor } from '../lib/import-sync-run';
import { getIsPremium } from '../lib/premium-cache';
import { useAuthStore } from './auth';
import { isImportBusy, useImportStore } from './import';

const STAGGER_MS = 17 * 60 * 1000;

interface SyncState {
  entries: SyncEntry[];
  running: string | null;
  enabling: string | null;
  enable: (history: HistoryEntry) => Promise<string | null>;
  disable: (id: string) => void;
  resume: (id: string) => void;
  syncNow: (id: string) => Promise<void>;
  reconnect: (id: string, token: string) => Promise<void>;
  acknowledge: () => void;
  forget: (id: string) => void;
}

let started = false;
let loading: Promise<void> | null = null;

export const useImportSyncStore = create<SyncState>((set, get) => ({
  entries: [],
  running: null,
  enabling: null,
  enable: enableEntry,
  disable: (id) => patch(id, { enabled: false }),
  resume: (id) => patch(id, { enabled: true, error: null, failures: 0 }),
  syncNow: (id) => runEntry(id),
  reconnect: async (id, token) => {
    const entry = find(id);
    if (!entry) return;
    patch(id, { request: withToken(entry.request, token), error: null, failures: 0, nextAt: 0 });
    await runEntry(id);
  },
  acknowledge: () => {
    if (!get().entries.some((entry) => entry.fresh > 0)) return;
    set((state) => ({ entries: state.entries.map((entry) => ({ ...entry, fresh: 0 })) }));
    persist();
  },
  forget: (id) => {
    set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) }));
    persist();
  },
}));

function find(id: string): SyncEntry | undefined {
  return useImportSyncStore.getState().entries.find((entry) => entry.id === id);
}

function persist() {
  void saveSyncEntries(useImportSyncStore.getState().entries);
}

function patch(id: string, change: Partial<SyncEntry>) {
  useImportSyncStore.setState((state) => ({
    entries: state.entries.map((entry) => (entry.id === id ? { ...entry, ...change } : entry)),
  }));
  persist();
}

function ensureLoaded(): Promise<void> {
  loading ??= loadSyncEntries().then((entries) => {
    useImportSyncStore.setState((state) => ({
      entries: [
        ...entries.filter((entry) => !state.entries.some((now) => now.id === entry.id)),
        ...state.entries,
      ],
    }));
  });
  return loading;
}

async function enableEntry(history: HistoryEntry): Promise<string | null> {
  await ensureLoaded();
  const source = history.sync;
  if (!source) return null;
  if (find(history.id)) {
    useImportSyncStore.getState().resume(history.id);
    return null;
  }
  const base: SyncEntry = {
    id: history.id,
    title: history.title,
    kind: history.kind,
    request: source.request,
    target: source.target,
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
  useImportSyncStore.setState({ enabling: history.id });
  try {
    const current = await currentUrns(base);
    const out = await pull(base, current, true);
    const now = Date.now();
    const stagger =
      (useImportSyncStore.getState().entries.length * STAGGER_MS) % (SYNC_INTERVAL_MS / 2);
    const entry: SyncEntry = {
      ...base,
      seen: out.seen,
      added: source.target.mode === 'playlist' ? current : [],
      lastAt: now,
      nextAt: now + SYNC_INTERVAL_MS + stagger,
    };
    useImportSyncStore.setState((state) => ({ entries: [...state.entries, entry] }));
    persist();
    return null;
  } catch (error) {
    return errorCodeOf(error);
  } finally {
    useImportSyncStore.setState({ enabling: null });
  }
}

async function runEntry(id: string) {
  await ensureLoaded();
  const entry = find(id);
  if (!entry || useImportSyncStore.getState().running) return;
  useImportSyncStore.setState({ running: id });
  try {
    const current = await currentUrns(entry);
    const out = await pull(entry, current, false);
    const fit = out.to_add.slice(0, roomFor(entry, current));
    await append(entry, fit);
    const dropped = new Set(out.to_add.slice(fit.length));
    patch(id, {
      seen: out.seen,
      added: out.added.filter((urn) => !dropped.has(urn)),
      latest: fit,
      removed: out.removed,
      lastAt: Date.now(),
      nextAt: Date.now() + SYNC_INTERVAL_MS,
      fresh: entry.fresh + fit.length,
      error: dropped.size > 0 ? 'playlist_full' : null,
      failures: 0,
    });
    if (fit.length > 0) {
      toast.success(i18n.t('importer.sync.toast', { count: fit.length, title: entry.title }), {
        id: `import-sync-${id}`,
      });
    }
  } catch (error) {
    const code = errorCodeOf(error);
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
