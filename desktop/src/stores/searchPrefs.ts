import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { tauriStorage } from '../lib/tauri-storage';

/**
 * `db` — поиск в локальной базе SCD (быстрее, ограничен зеркалом).
 * `sc` — fan-out в SoundCloud API (медленнее, видит всё).
 */
export type SearchSource = 'db' | 'sc';

/**
 * `text` — лексический поиск (название/артист + строчки лирики) с тизером «по вайбу».
 * `vibe` — чисто семантический поиск по вайбу (борда + атмосфера под выдачу).
 */
export type SearchMode = 'text' | 'vibe';

interface SearchPrefsState {
  source: SearchSource;
  setSource: (s: SearchSource) => void;
    mode: SearchMode;
    setMode: (m: SearchMode) => void;
}

export const useSearchPrefsStore = create<SearchPrefsState>()(
  persist(
    (set) => ({
      source: 'db',
      setSource: (source) => set({ source }),
        mode: 'text',
        setMode: (mode) => set({mode}),
    }),
    {
      name: 'sc-search-prefs',
      storage: createJSONStorage(() => tauriStorage),
    },
  ),
);
