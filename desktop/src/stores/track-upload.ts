import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import { create } from 'zustand';
import i18n from '../i18n';
import { queryClient } from '../lib/query-client';
import {
  cancelTrackUpload,
  failureText,
  isUploadFailure,
  PROGRESS_EVENT,
  startTrackUpload,
  type UploadFields,
  type UploadProgress,
} from '../lib/track-upload';

export type UploadPhase = 'idle' | 'sending' | 'processing' | 'done' | 'failed';

interface TrackUploadState {
  phase: UploadPhase;
  id: string | null;
  title: string;
  sent: number;
  total: number;
  error: string | null;
  reason: string | null;
  trackUrn: string | null;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  start: (filePath: string, artworkPath: string | null, fields: UploadFields) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

let listening: Promise<unknown> | null = null;

function listenForProgress() {
  listening ??= listen<UploadProgress>(PROGRESS_EVENT, ({ payload }) => {
    const state = useTrackUploadStore.getState();
    if (payload.id !== state.id || (state.phase !== 'sending' && state.phase !== 'processing')) {
      return;
    }
    useTrackUploadStore.setState({
      sent: payload.sent,
      total: payload.total,
      phase: payload.total > 0 && payload.sent >= payload.total ? 'processing' : 'sending',
    });
  }).catch(() => {
    listening = null;
  });
  return listening;
}

const IDLE = {
  phase: 'idle' as UploadPhase,
  id: null,
  title: '',
  sent: 0,
  total: 0,
  error: null,
  reason: null,
  trackUrn: null,
};

export const useTrackUploadStore = create<TrackUploadState>((set, get) => ({
  ...IDLE,
  dialogOpen: false,
  setDialogOpen: (dialogOpen) => set({ dialogOpen }),

  start: async (filePath, artworkPath, fields) => {
    const phase = get().phase;
    if (phase === 'sending' || phase === 'processing') return;
    const id = crypto.randomUUID();
    await listenForProgress();
    set({ ...IDLE, phase: 'sending', id, title: fields.title.trim() });
    try {
      const track = await startTrackUpload(id, filePath, artworkPath, fields);
      if (get().id !== id) return;
      set({ phase: 'done', trackUrn: track.urn ?? null });
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      if (!get().dialogOpen) {
        toast.success(i18n.t('upload.doneToast', { title: fields.title.trim() }));
      }
    } catch (error) {
      if (get().id !== id) return;
      if (isUploadFailure(error) && error.kind === 'cancelled') {
        set({ ...IDLE });
        toast(i18n.t('upload.cancelled'));
        return;
      }
      const reason = isUploadFailure(error) ? (error.message ?? null) : null;
      set({ phase: 'failed', error: failureText(error), reason });
      if (!get().dialogOpen) toast.error(i18n.t('upload.failedToast'));
    }
  },

  cancel: () => {
    const id = get().id;
    if (id) void cancelTrackUpload(id);
  },

  reset: () => {
    const phase = get().phase;
    if (phase === 'sending' || phase === 'processing') return;
    set({ ...IDLE });
  },
}));
