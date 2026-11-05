import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { MediaId, UploadState } from '../../lib/chat/media-types';
import type { ChatError, ConvId } from '../../lib/chat/types';
import { tauriStorage } from '../../lib/tauri-storage';
import { useChatMediaStore } from './media';

const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const KEEP_MAX = 200;
const ORPHANS_MAX = 40;
const MOVING: ReadonlySet<UploadState> = new Set(['uploading', 'uploaded']);

export type BackdropDialog = 'picker' | 'report';

export interface BackdropAttempt {
  id: string;
  error: ChatError | null;
  at: number;
}

interface BackdropState {
  hidden: Record<string, number>;
  attempts: Record<ConvId, BackdropAttempt>;
  orphans: Record<string, ChatError>;
  dialog: BackdropDialog | null;
  open: (dialog: BackdropDialog) => void;
  close: () => void;
  hide: (conversationId: ConvId, mediaId: MediaId) => void;
  show: (conversationId: ConvId, mediaId: MediaId) => void;
  started: (conversationId: ConvId, uploadId: string) => void;
  failed: (uploadId: string, error: ChatError) => void;
  recovered: (uploadId: string) => void;
  dismiss: (conversationId: ConvId) => void;
  forgetUploads: () => void;
}

export function hiddenKey(conversationId: ConvId, mediaId: MediaId) {
  return `${conversationId}:${mediaId}`;
}

function fresh<T>(entries: Record<string, T>, at: (value: T) => number, now: number) {
  const kept = Object.entries(entries)
    .filter(([, value]) => now - at(value) < KEEP_MS)
    .sort((a, b) => at(b[1]) - at(a[1]))
    .slice(0, KEEP_MAX);
  return Object.fromEntries(kept);
}

function attemptOf(attempts: Record<ConvId, BackdropAttempt>, uploadId: string) {
  return Object.entries(attempts).find(([, attempt]) => attempt.id === uploadId)?.[0] ?? null;
}

function withAttempt(
  state: BackdropState,
  conversationId: ConvId,
  attempt: BackdropAttempt | null,
) {
  const attempts = { ...state.attempts };
  if (attempt) attempts[conversationId] = attempt;
  else delete attempts[conversationId];
  return { attempts };
}

export const useBackdropStore = create<BackdropState>()(
  persist(
    (set) => ({
      hidden: {},
      attempts: {},
      orphans: {},
      dialog: null,
      open: (dialog) => set({ dialog }),
      close: () => set({ dialog: null }),
      hide: (conversationId, mediaId) =>
        set((state) => {
          const now = Date.now();
          const hidden = { ...state.hidden, [hiddenKey(conversationId, mediaId)]: now };
          return { hidden: fresh(hidden, (at) => at, now) };
        }),
      show: (conversationId, mediaId) =>
        set((state) => {
          const hidden = { ...state.hidden };
          delete hidden[hiddenKey(conversationId, mediaId)];
          return { hidden };
        }),
      started: (conversationId, uploadId) =>
        set((state) => {
          const now = Date.now();
          const error = state.orphans[uploadId] ?? null;
          const attempts = {
            ...state.attempts,
            [conversationId]: { id: uploadId, error, at: now },
          };
          return { attempts: fresh(attempts, (attempt) => attempt.at, now) };
        }),
      failed: (uploadId, error) =>
        set((state) => {
          const room = attemptOf(state.attempts, uploadId);
          if (room) return withAttempt(state, room, { ...state.attempts[room], error });
          const orphans = Object.entries({ ...state.orphans, [uploadId]: error }).slice(
            -ORPHANS_MAX,
          );
          return { orphans: Object.fromEntries(orphans) };
        }),
      recovered: (uploadId) =>
        set((state) => {
          const room = attemptOf(state.attempts, uploadId);
          if (!room || state.attempts[room].error === null) return state;
          return withAttempt(state, room, { ...state.attempts[room], error: null });
        }),
      dismiss: (conversationId) => set((state) => withAttempt(state, conversationId, null)),
      forgetUploads: () => set({ attempts: {}, orphans: {}, dialog: null }),
    }),
    {
      name: 'sc-chat-backdrop',
      storage: createJSONStorage(() => tauriStorage),
      partialize: (state) => ({ hidden: state.hidden, attempts: state.attempts }),
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
  for (const [id, error] of Object.entries(useChatMediaStore.getState().errors)) {
    useBackdropStore.getState().failed(id, error);
  }
  useChatMediaStore.subscribe((state, previous) => {
    const backdrop = useBackdropStore.getState();
    if (state.errors !== previous.errors) {
      for (const [id, error] of Object.entries(state.errors)) {
        if (previous.errors[id] !== error) backdrop.failed(id, error);
      }
    }
    if (state.uploads !== previous.uploads) {
      for (const upload of state.uploads) {
        if (upload.kind === 'backdrop' && MOVING.has(upload.state)) backdrop.recovered(upload.id);
      }
    }
  });
}
