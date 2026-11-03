import { create } from 'zustand';
import type { Track } from './player';

const QUIET_MS = 15 * 60_000;

interface PreviewEndState {
  track: Track | null;
  shownAt: number;
  ended: (track: Track) => void;
  clear: () => void;
}

/** The last Go+ snippet that just ran out, offered at most once per quiet window. */
export const usePreviewEnd = create<PreviewEndState>()((set, get) => ({
  track: null,
  shownAt: 0,
  ended: (track) => {
    const now = Date.now();
    if (now - get().shownAt < QUIET_MS) return;
    set({ track, shownAt: now });
  },
  clear: () => set({ track: null }),
}));
