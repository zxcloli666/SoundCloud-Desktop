import { create } from 'zustand';
import type { Track } from './player';

interface AddToPlaylistState {
  open: boolean;
  track: Track | null;
  request: (track: Track) => void;
  close: () => void;
}

export const useAddToPlaylistRequest = create<AddToPlaylistState>()((set) => ({
  open: false,
  track: null,
  request: (track) => set({ open: true, track }),
  close: () => set({ open: false }),
}));
