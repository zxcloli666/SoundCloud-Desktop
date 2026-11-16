import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { tauriStorage } from '../lib/tauri-storage';

export type SearchMode = 'catalog' | 'vibe' | 'soundcloud';
export type SearchView = 'covers' | 'moments';

interface SearchPrefsState {
  mode: SearchMode;
  view: SearchView;
  fromUrn: string | null;
  setMode: (mode: SearchMode) => void;
  setView: (view: SearchView) => void;
  toggleView: () => void;
  noteFrom: (urn: string) => void;
  momentsFrom: (urn: string) => void;
}

export function migrateSearchPrefs(persisted: unknown, version: number): SearchPrefsState {
  if (version >= 1) return persisted as SearchPrefsState;
  const old = persisted as { source?: string; mode?: string } | null;
  const mode: SearchMode =
    old?.source === 'sc' ? 'soundcloud' : old?.mode === 'vibe' ? 'vibe' : 'catalog';
  return { mode } as SearchPrefsState;
}

export const useSearchPrefsStore = create<SearchPrefsState>()(
  persist(
    (set) => ({
      mode: 'catalog',
      view: 'covers',
      fromUrn: null,
      setMode: (mode) => set({ mode }),
      setView: (view) => set({ view }),
      toggleView: () => set((s) => ({ view: s.view === 'covers' ? 'moments' : 'covers' })),
      noteFrom: (urn) => set({ fromUrn: urn }),
      momentsFrom: (urn) => set({ view: 'moments', fromUrn: urn }),
    }),
    {
      name: 'sc-search-prefs',
      version: 1,
      storage: createJSONStorage(() => tauriStorage),
      migrate: migrateSearchPrefs,
      partialize: ({ mode, view }) => ({ mode, view }),
    },
  ),
);
