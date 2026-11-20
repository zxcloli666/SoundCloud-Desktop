import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { withLyricsOffset } from '../lib/lyrics-offset';
import { createThrottledJsonStorage } from '../lib/tauri-storage';

interface LyricsOffsetState {
  offsets: Record<string, number>;
  setOffset: (urn: string, value: number) => void;
}

export const useLyricsOffsetStore = create<LyricsOffsetState>()(
  persist(
    (set) => ({
      offsets: {},
      setOffset: (urn, value) => set((s) => ({ offsets: withLyricsOffset(s.offsets, urn, value) })),
    }),
    {
      name: 'sc-lyrics-offset',
      storage: createThrottledJsonStorage(),
      version: 1,
      partialize: (s) => ({ offsets: s.offsets }) as LyricsOffsetState,
    },
  ),
);

export function lyricsOffsetOf(urn: string): number {
  return useLyricsOffsetStore.getState().offsets[urn] ?? 0;
}
