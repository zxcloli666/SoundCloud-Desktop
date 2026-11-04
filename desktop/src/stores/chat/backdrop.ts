import { listen } from '@tauri-apps/api/event';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { MediaId } from '../../lib/chat/media-types';
import type { ChatError, ConvId } from '../../lib/chat/types';
import { tauriStorage } from '../../lib/tauri-storage';
import { useChatMediaStore } from './media';

const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const KEEP_MAX = 200;

interface UploadErrorEvent {
  id: string;
  error: ChatError;
}

export type BackdropDialog = 'picker' | 'report';

interface BackdropState {
  hidden: Record<string, number>;
  failures: Record<string, ChatError>;
  dialog: BackdropDialog | null;
  open: (dialog: BackdropDialog) => void;
  close: () => void;
  hide: (conversationId: ConvId, mediaId: MediaId) => void;
  show: (conversationId: ConvId, mediaId: MediaId) => void;
  fail: (event: UploadErrorEvent) => void;
  forget: (uploadId: string) => void;
}

export function hiddenKey(conversationId: ConvId, mediaId: MediaId) {
  return `${conversationId}:${mediaId}`;
}

function pruned(hidden: Record<string, number>, now: number) {
  const fresh = Object.entries(hidden)
    .filter(([, at]) => now - at < KEEP_MS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, KEEP_MAX);
  return Object.fromEntries(fresh);
}

function isBackdropUpload(id: string) {
  return useChatMediaStore
    .getState()
    .uploads.some((upload) => upload.id === id && upload.kind === 'backdrop');
}

export const useBackdropStore = create<BackdropState>()(
  persist(
    (set) => ({
      hidden: {},
      failures: {},
      dialog: null,
      open: (dialog) => set({ dialog }),
      close: () => set({ dialog: null }),
      hide: (conversationId, mediaId) =>
        set((state) => {
          const now = Date.now();
          const hidden = { ...state.hidden, [hiddenKey(conversationId, mediaId)]: now };
          return { hidden: pruned(hidden, now) };
        }),
      show: (conversationId, mediaId) =>
        set((state) => {
          const hidden = { ...state.hidden };
          delete hidden[hiddenKey(conversationId, mediaId)];
          return { hidden };
        }),
      fail: ({ id, error }) =>
        set((state) =>
          isBackdropUpload(id) ? { failures: { ...state.failures, [id]: error } } : state,
        ),
      forget: (uploadId) =>
        set((state) => {
          if (!(uploadId in state.failures)) return state;
          const failures = { ...state.failures };
          delete failures[uploadId];
          return { failures };
        }),
    }),
    {
      name: 'sc-chat-backdrop',
      storage: createJSONStorage(() => tauriStorage),
      partialize: (state) => ({ hidden: state.hidden }),
    },
  ),
);

export const selectHidden =
  (conversationId: ConvId | null, mediaId: MediaId | null) => (state: BackdropState) =>
    conversationId !== null &&
    mediaId !== null &&
    hiddenKey(conversationId, mediaId) in state.hidden;

let watching = false;

export function watchBackdropUploads() {
  if (watching) return;
  watching = true;
  try {
    void listen<UploadErrorEvent>('chat:media-upload-error', (event) =>
      useBackdropStore.getState().fail(event.payload),
    ).catch(() => {
      watching = false;
    });
  } catch {
    watching = false;
  }
}
