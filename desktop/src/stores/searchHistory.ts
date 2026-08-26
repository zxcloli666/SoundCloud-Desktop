import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createThrottledJsonStorage } from '../lib/tauri-storage';

const MAX_HISTORY = 20;

interface SearchHistoryState {
  queries: string[];
  addQuery: (query: string) => void;
  removeQuery: (query: string) => void;
  clearHistory: () => void;
}

export const useSearchHistoryStore = create<SearchHistoryState>()(
  persist(
    (set, get) => ({
      queries: [],
      addQuery: (query) => {
        const q = query.trim();
        if (!q) return;
        if (get().queries[0] === q) return;
        set((s) => ({
          queries: [q, ...s.queries.filter((item) => item !== q)].slice(0, MAX_HISTORY),
        }));
      },
      removeQuery: (query) => set((s) => ({ queries: s.queries.filter((item) => item !== query) })),
      clearHistory: () => set({ queries: [] }),
    }),
    {
      name: 'sc-search-history',
      storage: createThrottledJsonStorage<SearchHistoryState>(1000),
    },
  ),
);
