import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OwnLyricsInput } from '../lib/lyrics';
import { createThrottledJsonStorage } from '../lib/tauri-storage';
import { useAuthStore } from './auth';

export interface PendingOwnLyrics {
  user: string;
  urn: string;
  input: OwnLyricsInput;
  at: number;
}

interface OwnLyricsState {
  pending: Record<string, PendingOwnLyrics>;
  keep: (entry: PendingOwnLyrics) => void;
  drop: (entry: PendingOwnLyrics) => void;
}

export function ownLyricsKey(user: string, urn: string): string {
  return `${user} ${urn}`;
}

export function pendingOwnLyrics(urn: string): PendingOwnLyrics | undefined {
  const user = useAuthStore.getState().user?.urn;
  return user ? useOwnLyricsStore.getState().pending[ownLyricsKey(user, urn)] : undefined;
}

export const useOwnLyricsStore = create<OwnLyricsState>()(
  persist(
    (set) => ({
      pending: {},
      keep: (entry) =>
        set((s) => ({ pending: { ...s.pending, [ownLyricsKey(entry.user, entry.urn)]: entry } })),
      drop: (entry) =>
        set((s) => {
          const key = ownLyricsKey(entry.user, entry.urn);
          if (s.pending[key]?.at !== entry.at) return s;
          const { [key]: _, ...rest } = s.pending;
          return { pending: rest };
        }),
    }),
    {
      name: 'sc-own-lyrics',
      storage: createThrottledJsonStorage(0),
      version: 1,
      partialize: (s) => ({ pending: s.pending }) as OwnLyricsState,
    },
  ),
);
