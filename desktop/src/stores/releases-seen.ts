import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { tauriStorage } from '../lib/tauri-storage';

const KEEP = 300;

interface ReleasesSeenState {
  owner: string | null;
  urns: string[];
  rebase: (owner: string, urns: string[]) => void;
  add: (urns: string[]) => void;
  forget: () => void;
}

export const useReleasesSeen = create<ReleasesSeenState>()(
  persist(
    (set) => ({
      owner: null,
      urns: [],
      rebase: (owner, urns) => set({ owner, urns: urns.slice(0, KEEP) }),
      add: (urns) => set((s) => ({ urns: [...new Set([...urns, ...s.urns])].slice(0, KEEP) })),
      forget: () => set({ owner: null, urns: [] }),
    }),
    {
      name: 'sc-releases-seen',
      storage: createJSONStorage(() => tauriStorage),
    },
  ),
);
