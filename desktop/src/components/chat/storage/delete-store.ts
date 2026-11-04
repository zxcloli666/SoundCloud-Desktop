import { create } from 'zustand';
import { chatBridge } from '../../../lib/chat/bridge';
import { chatError } from '../../../lib/chat/errors';
import type { MediaId, MediaSelection } from '../../../lib/chat/media-types';
import type { ChatError } from '../../../lib/chat/types';
import { useChatStore } from '../../../stores/chat';
import { useSelectionStore } from './selection-store';
import { useStorageStore } from './storage-store';

const BATCH = 500;
const DEFAULT_WINDOW_S = 15;

export interface UndoEntry {
  key: number;
  ids: MediaId[] | null;
  count: number;
  freed: number;
  startedAt: number;
  deadline: number;
}

export type UndoOutcome =
  | { kind: 'restored'; restored: number; missed: number }
  | { kind: 'quota'; used: number; quota: number }
  | { kind: 'failed'; error: ChatError };

export interface DeleteState {
  busy: boolean;
  error: ChatError | null;
  undo: UndoEntry | null;
  restoring: boolean;
  outcome: UndoOutcome | null;
  remove: (ids: MediaId[]) => Promise<boolean>;
  removeAll: () => Promise<boolean>;
  restore: () => Promise<void>;
  expire: (key: number) => void;
  dismissOutcome: () => void;
  clearError: () => void;
}

let keys = 0;

function errorOf(error: unknown): ChatError {
  return chatError(error) ?? { code: 'internal' };
}

function windowMs(): number {
  const seconds = useChatStore.getState().config?.media?.limits.restoreWindowS;
  return (seconds && seconds > 0 ? seconds : DEFAULT_WINDOW_S) * 1000;
}

function chunks<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let at = 0; at < list.length; at += BATCH) out.push(list.slice(at, at + BATCH));
  return out;
}

function merged(previous: UndoEntry | null, next: Omit<UndoEntry, 'key'>): UndoEntry {
  const live = previous && previous.deadline > Date.now() ? previous : null;
  if (!live) return { ...next, key: ++keys };
  return {
    key: ++keys,
    ids: live.ids && next.ids ? [...live.ids, ...next.ids] : null,
    count: live.count + next.count,
    freed: live.freed + next.freed,
    startedAt: next.startedAt,
    deadline: next.deadline,
  };
}

async function restoreSelection(selection: MediaSelection) {
  if (!selection.ids) return chatBridge.mediaRestore({ all: true });
  let restored = 0;
  let missed = 0;
  let last = null as Awaited<ReturnType<typeof chatBridge.mediaRestore>> | null;
  for (const ids of chunks(selection.ids)) {
    last = await chatBridge.mediaRestore({ ids });
    restored += last.restored;
    missed += last.missed;
  }
  return { restored, missed, used: last?.used ?? 0, quota: last?.quota ?? 0 };
}

export const useDeleteStore = create<DeleteState>()((set, get) => ({
  busy: false,
  error: null,
  undo: null,
  restoring: false,
  outcome: null,

  remove: async (ids) => {
    if (ids.length === 0 || get().busy) return false;
    const startedAt = Date.now();
    set({ busy: true, error: null });
    const done: MediaId[] = [];
    let deleted = 0;
    let freed = 0;
    try {
      for (const batch of chunks(ids)) {
        const answer = await chatBridge.mediaDelete({ ids: batch });
        done.push(...batch);
        deleted += answer.deleted;
        freed += answer.freed;
        useStorageStore.getState().setMeter({ used: answer.used, quota: answer.quota });
        useStorageStore.getState().dropItems(batch);
      }
    } catch (error) {
      set({ error: errorOf(error) });
    }
    if (done.length > 0) {
      const undo = merged(get().undo, {
        ids: done,
        count: deleted,
        freed,
        startedAt,
        deadline: startedAt + windowMs(),
      });
      set({ undo, outcome: null });
      const left = ids.filter((id) => !done.includes(id));
      if (left.length === 0) useSelectionStore.getState().clear();
      else useSelectionStore.getState().keepOnly(left);
      void useStorageStore.getState().loadUsage();
    }
    set({ busy: false });
    return done.length === ids.length;
  },

  removeAll: async () => {
    if (get().busy) return false;
    const startedAt = Date.now();
    set({ busy: true, error: null });
    try {
      const answer = await chatBridge.mediaDelete({ all: true });
      useStorageStore.getState().setMeter({ used: answer.used, quota: answer.quota });
      useStorageStore.getState().dropAll();
      useSelectionStore.getState().clear();
      const undo = merged(get().undo, {
        ids: null,
        count: answer.deleted,
        freed: answer.freed,
        startedAt,
        deadline: startedAt + windowMs(),
      });
      set({ undo: { ...undo, ids: null }, outcome: null, busy: false });
      void useStorageStore.getState().loadUsage();
      return true;
    } catch (error) {
      set({ error: errorOf(error), busy: false });
      return false;
    }
  },

  restore: async () => {
    const undo = get().undo;
    if (!undo || get().restoring) return;
    set({ restoring: true, outcome: null });
    try {
      const answer = await restoreSelection(undo.ids ? { ids: undo.ids } : { all: true });
      useStorageStore.getState().setMeter({ used: answer.used, quota: answer.quota });
      set({
        undo: null,
        restoring: false,
        outcome: { kind: 'restored', restored: answer.restored, missed: answer.missed },
      });
      void useStorageStore.getState().reload();
    } catch (error) {
      const failure = errorOf(error);
      const outcome: UndoOutcome =
        failure.code === 'quota_exceeded'
          ? { kind: 'quota', used: failure.used ?? 0, quota: failure.quota ?? 0 }
          : { kind: 'failed', error: failure };
      set({ restoring: false, outcome });
      void useStorageStore.getState().reload();
    }
  },

  expire: (key) => {
    if (get().undo?.key === key) set({ undo: null });
  },
  dismissOutcome: () => set({ outcome: null }),
  clearError: () => set({ error: null }),
}));
