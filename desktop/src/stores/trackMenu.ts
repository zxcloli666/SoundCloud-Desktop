import { create } from 'zustand';
import type { Track } from './player';

export interface TrackMenuTarget {
  track: Track;
  x: number;
  y: number;
  queueIndex?: number;
}

interface TrackMenuState {
  target: TrackMenuTarget | null;
  playlistTrackUrn: string | null;
  playlistOpen: boolean;
  open: (target: TrackMenuTarget) => void;
  close: () => void;
  openPlaylistDialog: (urn: string) => void;
  closePlaylistDialog: () => void;
}

export const useTrackMenuStore = create<TrackMenuState>((set) => ({
  target: null,
  playlistTrackUrn: null,
  playlistOpen: false,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
  openPlaylistDialog: (urn) => set({ target: null, playlistTrackUrn: urn, playlistOpen: true }),
  closePlaylistDialog: () => set({ playlistOpen: false }),
}));
