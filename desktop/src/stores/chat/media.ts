import { create } from 'zustand';
import { chatBridge } from '../../lib/chat/bridge';
import type {
  MediaId,
  MediaUploadsEvent,
  MediaUsage,
  UploadView,
} from '../../lib/chat/media-types';
import type { ConvId } from '../../lib/chat/types';
import type { ChatState } from './index';

export type MediaLoad = 'idle' | 'loading' | 'ready' | 'failed';
export type ShownMedia = 'loading' | 'ready' | 'deleted' | 'lost' | 'failed';

export const selectMediaOn = (state: ChatState) => state.config?.media?.uploads === true;
export const selectMediaStar = (state: ChatState) => state.config?.media?.star === true;

export interface ChatMediaState {
  uploads: UploadView[];
  usage: MediaUsage | null;
  usageLoad: MediaLoad;
  shown: Record<MediaId, ShownMedia>;
  setUploads: (uploads: UploadView[]) => void;
  applyUploads: (event: MediaUploadsEvent) => void;
  refreshUploads: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  setShown: (id: MediaId, shown: ShownMedia) => void;
  forgetShown: (ids: MediaId[]) => void;
  retryUpload: (id: string) => Promise<void>;
  cancelUpload: (id: string) => Promise<void>;
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
  setUploads: (uploads) => set({ uploads }),
  applyUploads: ({ uploads, removed }) =>
    set((state) => {
      const changed = new Map(uploads.map((upload) => [upload.id, upload]));
      const gone = new Set(removed);
      const kept = state.uploads
        .filter((upload) => !gone.has(upload.id))
        .map((upload) => changed.get(upload.id) ?? upload);
      const known = new Set(kept.map((upload) => upload.id));
      const added = uploads.filter((upload) => !known.has(upload.id) && !gone.has(upload.id));
      return { uploads: [...kept, ...added] };
    }),
  refreshUploads: async () => {
    set({ uploads: await chatBridge.mediaUploads() });
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
    await get().refreshUploads();
  },
  cancelUpload: async (id) => {
    await chatBridge.mediaUploadCancel(id);
    await get().refreshUploads();
  },
}));
