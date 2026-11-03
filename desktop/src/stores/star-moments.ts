import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { tauriStorage } from '../lib/tauri-storage';

interface StarMomentsState {
  /** Moment keys already shown, e.g. `expiry:1793306448:1`, `winback:1793306448`. */
  seen: string[];
  mark: (key: string) => void;
}

export const useStarMoments = create<StarMomentsState>()(
  persist(
    (set) => ({
      seen: [],
      mark: (key) => set((s) => (s.seen.includes(key) ? s : { seen: [...s.seen, key].slice(-50) })),
    }),
    {
      name: 'star-moments',
      storage: createJSONStorage(() => tauriStorage),
      partialize: (s) => ({ seen: s.seen }),
    },
  ),
);
