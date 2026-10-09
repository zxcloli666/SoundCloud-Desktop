import { create } from 'zustand';

interface AddToPlaylistRequestState {
  open: boolean;
  trackUrns: string[];
  request: (trackUrns: string[]) => void;
  setOpen: (open: boolean) => void;
}

export const useAddToPlaylistRequest = create<AddToPlaylistRequestState>()((set) => ({
  open: false,
  trackUrns: [],
  request: (trackUrns) => set({ open: true, trackUrns }),
  setOpen: (open) => set({ open }),
}));
