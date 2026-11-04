import { create } from 'zustand';
import { chatBridge } from '../../lib/chat/bridge';
import type {
  MediaId,
  MediaUploadErrorEvent,
  MediaUploadsEvent,
  MediaUsage,
  UploadState,
  UploadView,
} from '../../lib/chat/media-types';
import type { ChatError, ConvId } from '../../lib/chat/types';
import type { ChatState } from './index';

export type MediaLoad = 'idle' | 'loading' | 'ready' | 'failed';
export type ShownMedia = 'loading' | 'ready' | 'deleted' | 'lost' | 'failed';
export type SkipReason = 'type' | 'invalid' | 'full' | 'failed';

export interface Skipped {
  name: string;
  reason: SkipReason;
  error: ChatError | null;
}

export const selectMediaOn = (state: ChatState) => state.config?.media?.uploads === true;
export const selectMediaStar = (state: ChatState) => state.config?.media?.star === true;

export type MediaNote = 'locked' | 'paused' | 'room-host' | 'room-mods' | 'room-off';

export interface ChatMediaState {
  uploads: UploadView[];
  usage: MediaUsage | null;
  usageLoad: MediaLoad;
  shown: Record<MediaId, ShownMedia>;
  errors: Record<string, ChatError>;
  preparing: Record<ConvId, number>;
  skipped: Record<ConvId, Skipped[]>;
  sending: Record<string, true>;
  note: { conversationId: ConvId; gate: MediaNote } | null;
  setNote: (note: { conversationId: ConvId; gate: MediaNote } | null) => void;
  setUploads: (uploads: UploadView[]) => void;
  applyUploads: (event: MediaUploadsEvent) => void;
  applyError: (event: MediaUploadErrorEvent) => void;
  setPreparing: (conversationId: ConvId, count: number) => void;
  setSkipped: (conversationId: ConvId, skipped: Skipped[]) => void;
  setSending: (album: string, sending: boolean) => void;
  refreshUploads: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  setShown: (id: MediaId, shown: ShownMedia) => void;
  forgetShown: (ids: MediaId[]) => void;
  retryUpload: (id: string) => Promise<void>;
  cancelUpload: (id: string) => Promise<void>;
}

const STALLED: ReadonlySet<UploadState> = new Set(['failed', 'queued', 'reserved']);

function keptErrors(
  errors: Record<string, ChatError>,
  uploads: UploadView[],
): Record<string, ChatError> {
  const waiting = new Set(
    uploads.filter((upload) => STALLED.has(upload.state)).map((upload) => upload.id),
  );
  const ids = Object.keys(errors);
  if (ids.every((id) => waiting.has(id))) return errors;
  const kept: Record<string, ChatError> = {};
  for (const id of ids) if (waiting.has(id)) kept[id] = errors[id];
  return kept;
}

export function uploadsIn(uploads: UploadView[], conversationId: ConvId | null): UploadView[] {
  return conversationId === null
    ? uploads
    : uploads.filter((upload) => upload.conversationId === conversationId);
}

export const useChatMediaStore = create<ChatMediaState>()((set, get) => ({
  uploads: [],
  usage: null,
  usageLoad: 'idle',
  shown: {},
  errors: {},
  preparing: {},
  skipped: {},
  sending: {},
  note: null,
  setNote: (note) => set({ note }),
  setUploads: (uploads) => set((state) => ({ uploads, errors: keptErrors(state.errors, uploads) })),
  applyUploads: ({ uploads, removed }) =>
    set((state) => {
      const changed = new Map(uploads.map((upload) => [upload.id, upload]));
      const gone = new Set(removed);
      const kept = state.uploads
        .filter((upload) => !gone.has(upload.id))
        .map((upload) => changed.get(upload.id) ?? upload);
      const known = new Set(kept.map((upload) => upload.id));
      const added = uploads.filter((upload) => !known.has(upload.id) && !gone.has(upload.id));
      const next = [...kept, ...added];
      return { uploads: next, errors: keptErrors(state.errors, next) };
    }),
  applyError: ({ id, error }) => set((state) => ({ errors: { ...state.errors, [id]: error } })),
  setPreparing: (conversationId, count) =>
    set((state) => ({ preparing: { ...state.preparing, [conversationId]: count } })),
  setSkipped: (conversationId, skipped) =>
    set((state) => ({ skipped: { ...state.skipped, [conversationId]: skipped } })),
  setSending: (album, sending) =>
    set((state) => {
      const next = { ...state.sending };
      if (sending) next[album] = true;
      else delete next[album];
      return { sending: next };
    }),
  refreshUploads: async () => {
    get().setUploads(await chatBridge.mediaUploads());
  },
  refreshUsage: async () => {
    set({ usageLoad: 'loading' });
    try {
      set({ usage: await chatBridge.mediaUsage(), usageLoad: 'ready' });
    } catch {
      set({ usageLoad: 'failed' });
    }
  },
  setShown: (id, shown) => set((state) => ({ shown: { ...state.shown, [id]: shown } })),
  forgetShown: (ids) =>
    set((state) => {
      const shown = { ...state.shown };
      for (const id of ids) delete shown[id];
      return { shown };
    }),
  retryUpload: async (id) => {
    await chatBridge.mediaUploadRetry(id);
    set((state) => {
      const errors = { ...state.errors };
      delete errors[id];
      return { errors };
    });
    await get().refreshUploads();
  },
  cancelUpload: async (id) => {
    await chatBridge.mediaUploadCancel(id);
    await get().refreshUploads();
  },
}));
