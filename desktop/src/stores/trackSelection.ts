import { create } from 'zustand';
import { shuffleArray, type Track, usePlayerStore } from './player';

interface TrackSelectionState {
  picked: Track[];
  toggle: (track: Track) => void;
  clear: () => void;
  shuffle: () => void;
}

export const useTrackSelection = create<TrackSelectionState>((set, get) => ({
  picked: [],
  toggle: (track) =>
    set(({ picked }) => ({
      picked: picked.some((p) => p.urn === track.urn)
        ? picked.filter((p) => p.urn !== track.urn)
        : [...picked, track],
    })),
  clear: () => set({ picked: [] }),
  shuffle: () => {
    const queue = [...get().picked];
    if (queue.length === 0) return;
    shuffleArray(queue);
    usePlayerStore.getState().play(queue[0], queue);
    set({ picked: [] });
  },
}));

export function useTrackPicked(urn: string) {
  return useTrackSelection((s) => s.picked.some((p) => p.urn === urn));
}
