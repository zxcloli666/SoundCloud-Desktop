import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { selectAppMode, useAppStatusStore } from '../stores/app-status';
import { useAuthStore } from '../stores/auth';
import { ApiError, api } from './api';
import {
  afterListenedSent,
  afterPlaySent,
  LOCAL_ID,
  nextFor,
  type OutboxItem,
  ownedBy,
  type PlayBody,
  SAME_PLAY_MS,
  withListened,
  without,
  withPlay,
} from './history-outbox';
import { tauriStorage } from './tauri-storage';

const RETRY_EVERY_MS = 120_000;
const REMEMBERED_IDS = 100;

interface HistoryQueue {
  items: OutboxItem[];
}

const useHistoryQueue = create<HistoryQueue>()(
  persist(() => ({ items: [] as OutboxItem[] }), {
    name: 'sc-history-queue',
    storage: createJSONStorage(() => tauriStorage),
    merge: (stored, current) => ({
      items: [...((stored as HistoryQueue | undefined)?.items ?? []), ...current.items],
    }),
  }),
);

const serverIds = new Map<string, string>();
const lastPlay = new Map<string, { id: string; at: number }>();
let draining = false;
let again = false;

export function recordPlay(body: PlayBody): string | null {
  if (!useAuthStore.getState().hasSession) return null;
  const at = Date.now();
  for (const [track, play] of lastPlay) if (at - play.at >= SAME_PLAY_MS) lastPlay.delete(track);
  const same = lastPlay.get(body.scTrackId);
  if (same) return same.id;
  const id = `${LOCAL_ID}${at}:${body.scTrackId}`;
  lastPlay.set(body.scTrackId, { id, at });
  const user = useAuthStore.getState().user?.urn ?? null;
  update((items) => withPlay(items, { kind: 'play', id, user, playedAt: at, body, ms: 0 }));
  void flushHistory();
  return id;
}

export function reportListened(id: string, ms: number) {
  const user = useAuthStore.getState().user?.urn ?? null;
  update((items) => withListened(items, serverIds.get(id) ?? id, user, ms));
  void flushHistory();
}

export async function flushHistory(): Promise<void> {
  if (draining) {
    again = true;
    return;
  }
  draining = true;
  try {
    do {
      again = false;
      await drain();
    } while (again);
  } finally {
    draining = false;
  }
}

export function initHistoryQueue() {
  useHistoryQueue.persist.onFinishHydration(() => void flushHistory());
  if (useHistoryQueue.persist.hasHydrated()) void flushHistory();
  useAppStatusStore.subscribe((state, prev) => {
    if (selectAppMode(state) === 'online' && selectAppMode(prev) !== 'online') void flushHistory();
  });
  useAuthStore.subscribe((state, prev) => {
    if (prev.hasSession && !state.hasSession) update(ownedBy);
    if (state.user?.urn && state.user.urn !== prev.user?.urn) void flushHistory();
  });
  setInterval(() => {
    if (useHistoryQueue.getState().items.length > 0) void flushHistory();
  }, RETRY_EVERY_MS);
}

async function drain() {
  while (useHistoryQueue.persist.hasHydrated()) {
    const user = useAuthStore.getState().user?.urn;
    if (!user || selectAppMode(useAppStatusStore.getState()) !== 'online') return;
    const item = nextFor(useHistoryQueue.getState().items, user);
    if (!item || !(await send(item))) return;
  }
}

async function send(item: OutboxItem): Promise<boolean> {
  try {
    if (item.kind === 'play') {
      const row = await api<{ id?: string } | null>('/history', {
        method: 'POST',
        body: JSON.stringify({ ...item.body, playedAt: new Date(item.playedAt).toISOString() }),
      });
      const serverId = row?.id ?? null;
      if (serverId) remember(item.id, serverId);
      update((items) => afterPlaySent(items, item.id, serverId));
    } else {
      await api(`/history/${item.id}/listened`, {
        method: 'POST',
        body: JSON.stringify({ listenedMs: Math.round(item.ms) }),
      });
      update((items) => afterListenedSent(items, item.id, item.ms));
    }
    return true;
  } catch (error) {
    if (retryable(error)) return false;
    update((items) => without(items, item));
    return true;
  }
}

function retryable(error: unknown): boolean {
  if (error instanceof ApiError)
    return error.status >= 500 || [401, 408, 429].includes(error.status);
  return !(error instanceof SyntaxError);
}

function remember(localId: string, serverId: string) {
  serverIds.set(localId, serverId);
  if (serverIds.size > REMEMBERED_IDS) serverIds.delete(serverIds.keys().next().value as string);
}

function update(change: (items: OutboxItem[]) => OutboxItem[]) {
  useHistoryQueue.setState((state) => ({ items: change(state.items) }));
}
