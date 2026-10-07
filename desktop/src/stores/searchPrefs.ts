import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { tauriStorage } from '../lib/tauri-storage';

export type SearchMode = 'catalog' | 'vibe' | 'soundcloud';

interface SearchPrefsState {
  mode: SearchMode;
  setMode: (mode: SearchMode) => void;
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
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'sc-search-prefs',
      version: 1,
      storage: createJSONStorage(() => tauriStorage),
      migrate: migrateSearchPrefs,
    },
  ),
);
