import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { tauriStorage } from '../lib/tauri-storage';

export type SearchMode = 'catalog' | 'vibe' | 'soundcloud';
export type SearchView = 'covers' | 'moments';
export type SearchLayout = 'tiles' | 'list';

interface SearchPrefsState {
  mode: SearchMode;
  view: SearchView;
  layout: SearchLayout;
  fromUrn: string | null;
  setMode: (mode: SearchMode) => void;
  setView: (view: SearchView) => void;
  setLayout: (layout: SearchLayout) => void;
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
      layout: 'tiles',
      fromUrn: null,
      setMode: (mode) => set({ mode }),
      setView: (view) => set({ view }),
      setLayout: (layout) => set({ layout }),
      toggleView: () => set((s) => ({ view: s.view === 'covers' ? 'moments' : 'covers' })),
      noteFrom: (urn) => set({ fromUrn: urn }),
      momentsFrom: (urn) => set({ view: 'moments', fromUrn: urn }),
    }),
    {
      name: 'sc-search-prefs',
      version: 1,
      storage: createJSONStorage(() => tauriStorage),
      migrate: migrateSearchPrefs,
      partialize: ({ mode, view, layout }) => ({ mode, view, layout }),
    },
  ),
);
