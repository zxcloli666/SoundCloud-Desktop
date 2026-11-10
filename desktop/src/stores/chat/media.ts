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
import { forgetTimers } from './forget-timers';
import type { ChatState } from './index';

export type MediaLoad = 'idle' | 'loading' | 'ready' | 'failed';
export type ShownMedia = 'loading' | 'ready' | 'deleted' | 'lost' | 'failed';
export type SkipReason = 'type' | 'invalid' | 'full' | 'failed';

export interface Skipped {
  name: string;
  reason: SkipReason;
  error: ChatError | null;
}

export const selectMediaKnown = (state: ChatState) => (state.config?.media ?? null) !== null;
export const selectMediaStar = (state: ChatState) => state.config?.media?.star === true;

export type MediaNote = 'locked' | 'paused' | 'room-host' | 'room-mods' | 'room-off';

interface MediaData {
  uploads: UploadView[];
  local: boolean;
  usage: MediaUsage | null;
  usageLoad: MediaLoad;
  shown: Record<MediaId, ShownMedia>;
  errors: Record<string, ChatError>;
  preparing: Record<ConvId, number>;
  skipped: Record<ConvId, Skipped[]>;
  sending: Record<string, true>;
  parked: Record<string, true>;
  parkedReady: boolean;
  dismissed: Record<string, true>;
  note: { conversationId: ConvId; gate: MediaNote } | null;
}

export interface ChatMediaState extends MediaData {
  setNote: (note: { conversationId: ConvId; gate: MediaNote } | null) => void;
  setUploads: (uploads: UploadView[]) => void;
  applyUploads: (event: MediaUploadsEvent) => void;
  applyError: (event: MediaUploadErrorEvent) => void;
  setPreparing: (conversationId: ConvId, count: number) => void;
  setSkipped: (conversationId: ConvId, skipped: Skipped[]) => void;
  setSending: (album: string, sending: boolean) => void;
  setDismissed: (album: string, dismissed: boolean) => void;
  refreshUploads: () => Promise<void>;
  refreshParked: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  setShown: (id: MediaId, shown: ShownMedia, forgetInMs?: number | null) => void;
  reviveMedia: (id: MediaId) => Promise<void>;
  forgetShown: (ids: MediaId[]) => void;
  retryUpload: (id: string) => Promise<void>;
  retryUploads: (ids: string[]) => Promise<void>;
  cancelUpload: (id: string) => Promise<void>;
  reset: () => void;
}

const STALLED: ReadonlySet<UploadState> = new Set(['failed', 'queued', 'reserved']);
let usageFetch: Promise<void> | null = null;
const forgetting = forgetTimers<MediaId>((id) => useChatMediaStore.getState().forgetShown([id]));

function emptyMedia(): MediaData {
  return {
    uploads: [],
    local: false,
    usage: null,
    usageLoad: 'idle',
    shown: {},
    errors: {},
    preparing: {},
    skipped: {},
    sending: {},
    parked: {},
    parkedReady: false,
    dismissed: {},
    note: null,
  };
}

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

function flagged(flags: Record<string, true>, key: string, on: boolean): Record<string, true> {
  const next = { ...flags };
  if (on) next[key] = true;
  else delete next[key];
  return next;
}

export function uploadsIn(uploads: UploadView[], conversationId: ConvId | null): UploadView[] {
  return conversationId === null
    ? uploads
    : uploads.filter((upload) => upload.conversationId === conversationId);
}

export const useChatMediaStore = create<ChatMediaState>()((set, get) => ({
  ...emptyMedia(),
  setNote: (note) => set({ note }),
  setUploads: (uploads) =>
    set((state) => ({ uploads, local: true, errors: keptErrors(state.errors, uploads) })),
  applyUploads: ({ uploads, removed }) => {
    const gone = new Set(removed);
    const changed = new Map(uploads.map((upload) => [upload.id, upload]));
    const kept = get()
      .uploads.filter((upload) => !gone.has(upload.id))
      .map((upload) => changed.get(upload.id) ?? upload);
    const known = new Set(kept.map((upload) => upload.id));
    const added = uploads.filter((upload) => !known.has(upload.id) && !gone.has(upload.id));
    const next = [...kept, ...added];
    set((state) => ({ uploads: next, local: true, errors: keptErrors(state.errors, next) }));
    if (added.length > 0 || gone.size > 0) void get().refreshParked();
  },
  applyError: ({ id, error }) => set((state) => ({ errors: { ...state.errors, [id]: error } })),
  setPreparing: (conversationId, count) =>
    set((state) => ({ preparing: { ...state.preparing, [conversationId]: count } })),
  setSkipped: (conversationId, skipped) =>
    set((state) => ({ skipped: { ...state.skipped, [conversationId]: skipped } })),
  setSending: (album, sending) =>
    set((state) => ({ sending: flagged(state.sending, album, sending) })),
  setDismissed: (album, dismissed) =>
    set((state) => ({ dismissed: flagged(state.dismissed, album, dismissed) })),
  refreshUploads: async () => {
    get().setUploads(await chatBridge.mediaUploads());
    await get().refreshParked();
  },
  refreshParked: async () => {
    try {
      const albums = await chatBridge.mediaParked();
      set({
        parked: Object.fromEntries(albums.map((album) => [album, true as const])),
        parkedReady: true,
      });
    } catch {
      return;
    }
  },
  refreshUsage: () => {
    usageFetch ??= (async () => {
      set({ usageLoad: 'loading' });
      try {
        set({ usage: await chatBridge.mediaUsage(), usageLoad: 'ready' });
      } catch {
        set({ usageLoad: 'failed' });
      } finally {
        usageFetch = null;
      }
    })();
    return usageFetch;
  },
  setShown: (id, shown, forgetInMs) => {
    forgetting.schedule(id, forgetInMs);
    set((state) =>
      state.shown[id] === shown ? state : { shown: { ...state.shown, [id]: shown } },
    );
  },
  reviveMedia: async (id) => {
    await chatBridge.mediaRetry(id).catch(() => undefined);
    get().forgetShown([id]);
  },
  forgetShown: (ids) =>
    set((state) => {
      for (const id of ids) forgetting.cancel(id);
      if (!ids.some((id) => id in state.shown)) return state;
      const shown = { ...state.shown };
      for (const id of ids) delete shown[id];
      return { shown };
    }),
  retryUpload: (id) => get().retryUploads([id]),
  retryUploads: async (ids) => {
    const outcomes = await Promise.allSettled(ids.map((id) => chatBridge.mediaUploadRetry(id)));
    const restarted = ids.filter((_, index) => outcomes[index].status === 'fulfilled');
    set((state) => {
      const errors = { ...state.errors };
      for (const id of restarted) delete errors[id];
      return { errors };
    });
    await get().refreshUploads();
    const refused = outcomes.find(
      (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
    );
    if (refused) throw refused.reason;
  },
  cancelUpload: async (id) => {
    await chatBridge.mediaUploadCancel(id);
    await get().refreshUploads();
  },
  reset: () => {
    forgetting.clear();
    set(emptyMedia());
  },
}));
