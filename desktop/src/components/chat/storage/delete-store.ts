import { create } from 'zustand';
import { chatBridge } from '../../../lib/chat/bridge';
import { chatError } from '../../../lib/chat/errors';
import type { MediaId, MyMedia, RestoreAnswer } from '../../../lib/chat/media-types';
import type { ChatError } from '../../../lib/chat/types';
import { useChatStore } from '../../../stores/chat';
import { useChatMediaStore } from '../../../stores/chat/media';
import { useSelectionStore } from './selection-store';
import { useStorageStore } from './storage-store';

const BATCH = 500;
const DEFAULT_WINDOW_S = 15;

export interface UndoEntry {
  key: number;
  items: MyMedia[] | null;
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
  remove: (items: MyMedia[]) => Promise<MediaId[]>;
  removeAll: () => Promise<boolean>;
  restore: () => Promise<void>;
  expire: (key: number) => void;
  dismissOutcome: () => void;
  clearError: () => void;
  leavePage: () => void;
}

let keys = 0;

function errorOf(error: unknown): ChatError {
  return chatError(error) ?? { code: 'internal' };
}

export function restoreWindowS(): number {
  const seconds = useChatStore.getState().config?.media?.limits.restoreWindowS;
  return seconds && seconds > 0 ? seconds : DEFAULT_WINDOW_S;
}

function chunks<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let at = 0; at < list.length; at += BATCH) out.push(list.slice(at, at + BATCH));
  return out;
}

function uniqueItems(items: MyMedia[]): MyMedia[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function merged(previous: UndoEntry | null, next: Omit<UndoEntry, 'key'>): UndoEntry {
  const live = previous && previous.deadline > Date.now() ? previous : null;
  if (!live) return { ...next, key: ++keys };
  return {
    key: ++keys,
    items: live.items && next.items ? uniqueItems([...live.items, ...next.items]) : null,
    count: live.count + next.count,
    freed: live.freed + next.freed,
    startedAt: next.startedAt,
    deadline: next.deadline,
  };
}

async function restoreItems(items: MyMedia[] | null): Promise<RestoreAnswer> {
  if (!items) return chatBridge.mediaRestore({ all: true });
  let restored = 0;
  let missed = 0;
  let used = 0;
  let quota = 0;
  for (const batch of chunks(items.map((item) => item.id))) {
    const answer = await chatBridge.mediaRestore({ ids: batch });
    restored += answer.restored;
    missed += answer.missed;
    used = answer.used;
    quota = answer.quota;
  }
  return { restored, missed, used, quota };
}

function forgetGone(items: MyMedia[] | null) {
  const media = useChatMediaStore.getState();
  media.forgetShown(items ? items.map((item) => item.id) : Object.keys(media.shown));
}

function offerUndo(entry: Omit<UndoEntry, 'key'>) {
  const state = useDeleteStore.getState();
  const previous = state.restoring ? null : state.undo;
  useDeleteStore.setState({ undo: merged(previous, entry), outcome: null });
}

export const useDeleteStore = create<DeleteState>()((set, get) => ({
  busy: false,
  error: null,
  undo: null,
  restoring: false,
  outcome: null,

  remove: async (items) => {
    const ids = items.map((item) => item.id);
    if (ids.length === 0 || get().busy) return ids;
    const startedAt = Date.now();
    set({ busy: true, error: null });
    const done = new Set<MediaId>();
    let deleted = 0;
    let freed = 0;
    try {
      for (const batch of chunks(ids)) {
        const answer = await chatBridge.mediaDelete({ ids: batch });
        for (const id of batch) done.add(id);
        deleted += answer.deleted;
        freed += answer.freed;
        useStorageStore.getState().setMeter({ used: answer.used, quota: answer.quota });
        useStorageStore.getState().dropItems(batch);
      }
    } catch (error) {
      set({ error: errorOf(error) });
    }
    const left = ids.filter((id) => !done.has(id));
    if (done.size > 0) {
      if (deleted > 0) {
        offerUndo({
          items: items.filter((item) => done.has(item.id)),
          count: deleted,
          freed,
          startedAt,
          deadline: startedAt + restoreWindowS() * 1000,
        });
      }
      if (left.length === 0) useSelectionStore.getState().clear();
      else useSelectionStore.getState().keepOnly(left);
      void useStorageStore.getState().loadUsage();
    }
    set({ busy: false });
    return left;
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
      if (answer.deleted > 0) {
        offerUndo({
          items: null,
          count: answer.deleted,
          freed: answer.freed,
          startedAt,
          deadline: startedAt + restoreWindowS() * 1000,
        });
      }
      set({ busy: false });
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
      const answer = await restoreItems(undo.items);
      forgetGone(undo.items);
      const storage = useStorageStore.getState();
      storage.setMeter({ used: answer.used, quota: answer.quota });
      if (undo.items && answer.missed === 0) storage.putBack(undo.items);
      else void storage.loadItems();
      void storage.loadUsage();
      set({
        undo: get().undo?.key === undo.key ? null : get().undo,
        restoring: false,
        outcome: { kind: 'restored', restored: answer.restored, missed: answer.missed },
      });
    } catch (error) {
      const failure = errorOf(error);
      const outcome: UndoOutcome =
        failure.code === 'quota_exceeded'
          ? { kind: 'quota', used: failure.used ?? 0, quota: failure.quota ?? 0 }
          : { kind: 'failed', error: failure };
      set({ restoring: false, outcome });
      if (outcome.kind === 'failed') void useStorageStore.getState().reload();
    }
  },

  expire: (key) => {
    if (get().undo?.key === key) set({ undo: null });
  },
  dismissOutcome: () => set({ outcome: null }),
  clearError: () => set({ error: null }),
  leavePage: () => {
    const undo = get().undo;
    set({
      outcome: null,
      error: null,
      undo: undo && undo.deadline > Date.now() ? undo : null,
    });
  },
}));
