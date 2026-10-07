import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { tauriStorage } from '../lib/tauri-storage';

export type BlockKind = 'user' | 'artist';

export interface BlockedArtist {
  kind: BlockKind;
  id: string;
  name: string;
  avatar_url?: string | null;
  sc_user_ids: string[];
  created_at?: string;
}

interface BlockedArtistsState {
  owner: string | null;
  entries: BlockedArtist[];
  setEntries: (owner: string, entries: BlockedArtist[]) => void;
  upsert: (entry: BlockedArtist) => void;
  remove: (kind: BlockKind, id: string) => void;
}

export function sameTarget(a: Pick<BlockedArtist, 'kind' | 'id'>, kind: BlockKind, id: string) {
  return a.kind === kind && a.id === id;
}

export const useBlockedArtistsStore = create<BlockedArtistsState>()(
  persist(
    (set) => ({
      owner: null,
      entries: [],
      setEntries: (owner, entries) => set({ owner, entries }),
      upsert: (entry) =>
        set((s) => ({
          entries: [entry, ...s.entries.filter((e) => !sameTarget(e, entry.kind, entry.id))],
        })),
      remove: (kind, id) =>
        set((s) => ({ entries: s.entries.filter((e) => !sameTarget(e, kind, id)) })),
    }),
    {
      name: 'sc-blocked-artists',
      storage: createJSONStorage(() => tauriStorage),
      version: 1,
      partialize: (s) => ({ owner: s.owner, entries: s.entries }),
    },
  ),
);

export function whenBlocklistHydrated(): Promise<void> {
  if (useBlockedArtistsStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const stop = useBlockedArtistsStore.persist.onFinishHydration(() => {
      stop();
      resolve();
    });
  });
}
