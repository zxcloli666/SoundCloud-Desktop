import { create } from 'zustand';
import { coverErrorKey, uploadCover } from '../lib/playlist-artwork';

export type CoverPhase = 'sending' | 'syncing' | 'failed';

export type CoverChange = {
  phase: CoverPhase;
  preview: string;
  jpeg: Blob;
  before: string | null;
  error: string | null;
};

type CoverState = {
  changes: Record<string, CoverChange>;
  send: (playlistUrn: string, jpeg: Blob, before: string | null) => Promise<void>;
  retry: (playlistUrn: string) => void;
  drop: (playlistUrn: string) => void;
};

export const usePlaylistCoverStore = create<CoverState>((set, get) => {
  const patch = (playlistUrn: string, jpeg: Blob, next: Partial<CoverChange>) => {
    const current = get().changes[playlistUrn];
    if (current?.jpeg !== jpeg) return;
    set({ changes: { ...get().changes, [playlistUrn]: { ...current, ...next } } });
  };

  return {
    changes: {},

    send: async (playlistUrn, jpeg, before) => {
      const previous = get().changes[playlistUrn];
      const preview = previous?.jpeg === jpeg ? previous.preview : URL.createObjectURL(jpeg);
      if (previous && previous.preview !== preview) URL.revokeObjectURL(previous.preview);
      set({
        changes: {
          ...get().changes,
          [playlistUrn]: { phase: 'sending', preview, jpeg, before, error: null },
        },
      });
      try {
        await uploadCover(playlistUrn, jpeg);
        patch(playlistUrn, jpeg, { phase: 'syncing' });
      } catch (error) {
        patch(playlistUrn, jpeg, { phase: 'failed', error: coverErrorKey(error) });
      }
    },

    retry: (playlistUrn) => {
      const change = get().changes[playlistUrn];
      if (change?.phase === 'failed') void get().send(playlistUrn, change.jpeg, change.before);
    },

    drop: (playlistUrn) => {
      const change = get().changes[playlistUrn];
      if (!change) return;
      URL.revokeObjectURL(change.preview);
      const { [playlistUrn]: _, ...rest } = get().changes;
      set({ changes: rest });
    },
  };
});
