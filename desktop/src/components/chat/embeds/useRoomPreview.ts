import { useEffect } from 'react';
import { chatBridge } from '../../../lib/chat/bridge';
import type { RoomPreview } from '../../../lib/chat/types';
import { useChatEmbedsStore } from '../../../stores/chat/embeds';

const POLL_MS = 30_000;

interface Watch {
  viewers: number;
  timer: ReturnType<typeof setInterval>;
  lastAt: number;
  busy: boolean;
}

const watches = new Map<string, Watch>();
let resumeBound = false;

function isGone(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  return (error as { code?: unknown }).code === 'not_found';
}

async function refresh(code: string): Promise<void> {
  const watch = watches.get(code);
  const store = useChatEmbedsStore.getState();
  if (!watch || watch.busy || store.closedRooms[code]) return;
  if (document.visibilityState === 'hidden') return;
  watch.lastAt = Date.now();
  watch.busy = true;
  try {
    store.setRoomPreview(code, await chatBridge.roomPreview(code));
  } catch (error) {
    if (isGone(error)) store.closeRoom(code);
  } finally {
    watch.busy = false;
  }
  if (useChatEmbedsStore.getState().closedRooms[code]) stopWatch(code);
}

function stopWatch(code: string): void {
  const watch = watches.get(code);
  if (!watch) return;
  clearInterval(watch.timer);
  watches.delete(code);
}

function refreshStale(): void {
  if (document.visibilityState !== 'visible') return;
  for (const [code, watch] of watches) {
    if (Date.now() - watch.lastAt >= POLL_MS) void refresh(code);
  }
}

function watchRoom(code: string): () => void {
  if (!resumeBound) {
    resumeBound = true;
    document.addEventListener('visibilitychange', refreshStale);
  }
  const existing = watches.get(code);
  if (existing) {
    existing.viewers++;
    if (Date.now() - existing.lastAt >= POLL_MS) void refresh(code);
  } else {
    watches.set(code, {
      viewers: 1,
      timer: setInterval(() => void refresh(code), POLL_MS),
      lastAt: 0,
      busy: false,
    });
    void refresh(code);
  }
  return () => {
    const watch = watches.get(code);
    if (!watch) return;
    watch.viewers--;
    if (watch.viewers <= 0) stopWatch(code);
  };
}

export interface RoomLiveState {
  preview: RoomPreview | null;
  closed: boolean;
}

export function useRoomPreview(code: string, visible: boolean): RoomLiveState {
  const preview = useChatEmbedsStore((state) => state.roomPreviews[code] ?? null);
  const closed = useChatEmbedsStore((state) => state.closedRooms[code] === true);

  useEffect(() => {
    if (!visible || closed || !code) return;
    return watchRoom(code);
  }, [code, visible, closed]);

  return { preview, closed };
}
