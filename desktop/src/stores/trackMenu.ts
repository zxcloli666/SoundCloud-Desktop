import { create } from 'zustand';
import type { Track } from './player';

export interface TrackMenuTarget {
  track: Track;
  x: number;
  y: number;
  queueIndex?: number;
  scope?: string;
  above?: boolean;
}

interface TrackMenuState {
  target: TrackMenuTarget | null;
  open: (target: TrackMenuTarget) => void;
  close: () => void;
}

export const useTrackMenuStore = create<TrackMenuState>((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}));
