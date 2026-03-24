import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { tauriStorage } from '../lib/tauri-storage';

export interface Track {
  id: number;
  urn: string;
  title: string;
  duration: number;
  artwork_url: string | null;
  permalink_url?: string;
  waveform_url?: string;
  genre?: string;
  tag_list?: string;
  description?: string;
  created_at?: string;
  comment_count?: number;
  playback_count?: number;
  likes_count?: number;
  favoritings_count?: number;
  reposts_count?: number;
  user_favorite?: boolean;
  access?: 'playable' | 'preview' | 'blocked';
  user: {
    id: number;
    urn: string;
    username: string;
    avatar_url: string;
    permalink_url: string;
  };
}

type RepeatMode = 'off' | 'one' | 'all';

function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  originalQueue: Track[] | null;
  queueIndex: number;
  isPlaying: boolean;
  volume: number;
  volumeBeforeMute: number;
  shuffle: boolean;
  repeat: RepeatMode;

  play: (track: Track, queue?: Track[]) => void;
  playFromQueue: (index: number) => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
  setQueue: (queue: Track[]) => void;
  addToQueue: (tracks: Track[]) => void;
  addToQueueNext: (tracks: Track[]) => void;
  removeFromQueue: (index: number) => void;
  moveInQueue: (from: number, to: number) => void;
  clearQueue: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setCurrentTrackAccess: (access: Track['access']) => void;
  replaceTrackMetadata: (track: Track) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      queue: [],
      originalQueue: null,
      queueIndex: -1,
      isPlaying: false,
      volume: 50,
      volumeBeforeMute: 50,
      shuffle: false,
      repeat: 'off',

      play: (track, queue) => {
        if (queue) {
          const { shuffle } = get();
          const idx = queue.findIndex((t) => t.urn === track.urn);
          const realIdx = idx >= 0 ? idx : 0;

          if (shuffle) {
            const original = [...queue];
            const rest = [...queue.slice(0, realIdx), ...queue.slice(realIdx + 1)];
            shuffleArray(rest);
            set({
              currentTrack: track,
              queue: [track, ...rest],
              queueIndex: 0,
              isPlaying: true,
              originalQueue: original,
            });
          } else {
            set({
              currentTrack: track,
              queue,
              queueIndex: realIdx,
              isPlaying: true,
              originalQueue: null,
            });
          }
        } else {
          const { queue: currentQueue } = get();
          set({
            currentTrack: track,
            queue: [...currentQueue, track],
            queueIndex: currentQueue.length,
            isPlaying: true,
          });
        }
      },

      playFromQueue: (index) => {
        const { queue } = get();
        if (index < 0 || index >= queue.length) return;
        set({
          currentTrack: queue[index],
          queueIndex: index,
          isPlaying: true,
        });
      },

      pause: () => set({ isPlaying: false }),
      resume: () => set({ isPlaying: true }),

      togglePlay: () => {
        const { isPlaying, currentTrack } = get();
        if (currentTrack) set({ isPlaying: !isPlaying });
      },

      next: () => {
        const { queue, queueIndex, repeat } = get();
        if (queue.length === 0) return;

        let nextIdx = queueIndex + 1;

        if (nextIdx >= queue.length) {
          if (repeat === 'all') nextIdx = 0;
          else {
            set({ isPlaying: false });
            return;
          }
        }

        set({
          currentTrack: queue[nextIdx],
          queueIndex: nextIdx,
          isPlaying: true,
        });
      },

      prev: () => {
        const { queue, queueIndex } = get();
        const prevIdx = Math.max(0, queueIndex - 1);
        set({
          currentTrack: queue[prevIdx],
          queueIndex: prevIdx,
          isPlaying: true,
        });
      },

      setVolume: (v) => {
        const clamped = Math.round(Math.max(0, Math.min(200, v)));
        const prev = get().volume;
        set({
          volume: clamped,
          ...(clamped === 0 && prev > 0 ? { volumeBeforeMute: prev } : {}),
        });
      },

      setQueue: (queue) =>
        set((s) => {
          const idx = s.currentTrack ? queue.findIndex((t) => t.urn === s.currentTrack!.urn) : -1;
          return {
            queue,
            queueIndex: idx >= 0 ? idx : s.queueIndex,
            originalQueue: s.shuffle ? [...queue] : null,
          };
        }),

      addToQueue: (tracks) =>
        set((s) => ({
          queue: [...s.queue, ...tracks],
          originalQueue: s.originalQueue ? [...s.originalQueue, ...tracks] : null,
        })),

      addToQueueNext: (tracks) =>
        set((s) => {
          const queue = [...s.queue];
          const insertIndex = s.queueIndex >= 0 ? s.queueIndex + 1 : 0;
          queue.splice(insertIndex, 0, ...tracks);
          return {
            queue,
            originalQueue: s.originalQueue ? [...s.originalQueue, ...tracks] : null,
          };
        }),

      removeFromQueue: (index) =>
        set((s) => {
          const removed = s.queue[index];
          const queue = s.queue.filter((_, i) => i !== index);
          const queueIndex =
            index < s.queueIndex
              ? s.queueIndex - 1
              : index === s.queueIndex
                ? Math.min(s.queueIndex, queue.length - 1)
                : s.queueIndex;
          let originalQueue = s.originalQueue;
          if (originalQueue && removed) {
            const oq = [...originalQueue];
            const oi = oq.findIndex((t) => t.urn === removed.urn);
            if (oi >= 0) oq.splice(oi, 1);
            originalQueue = oq;
          }
          return { queue, queueIndex, originalQueue };
        }),

      moveInQueue: (from, to) =>
        set((s) => {
          const queue = [...s.queue];
          const [item] = queue.splice(from, 1);
          queue.splice(to, 0, item);
          let queueIndex = s.queueIndex;
          if (s.queueIndex === from) queueIndex = to;
          else if (from < s.queueIndex && to >= s.queueIndex) queueIndex--;
          else if (from > s.queueIndex && to <= s.queueIndex) queueIndex++;
          return { queue, queueIndex };
        }),

      clearQueue: () => set({ queue: [], queueIndex: -1, originalQueue: null }),

      toggleShuffle: () => {
        const { shuffle, queue, queueIndex, currentTrack } = get();
        if (!shuffle) {
          // ON: save original order, shuffle everything after current track
          const original = [...queue];
          const after = [...queue.slice(queueIndex + 1)];
          shuffleArray(after);
          set({
            shuffle: true,
            originalQueue: original,
            queue: [...queue.slice(0, queueIndex + 1), ...after],
          });
        } else {
          // OFF: restore original order
          const { originalQueue } = get();
          if (originalQueue && currentTrack) {
            const idx = originalQueue.findIndex((t) => t.urn === currentTrack.urn);
            set({
              shuffle: false,
              queue: originalQueue,
              queueIndex: idx >= 0 ? idx : 0,
              originalQueue: null,
            });
          } else {
            set({ shuffle: false, originalQueue: null });
          }
        }
      },

      toggleRepeat: () =>
        set((s) => ({
          repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off',
        })),

      setCurrentTrackAccess: (access) =>
        set((s) => (s.currentTrack ? { currentTrack: { ...s.currentTrack, access } } : {})),

      replaceTrackMetadata: (track) =>
        set((s) => {
          const mergeTrack = (item: Track) =>
            item.urn === track.urn ? { ...item, ...track } : item;

          return {
            currentTrack:
              s.currentTrack?.urn === track.urn ? { ...s.currentTrack, ...track } : s.currentTrack,
            queue: s.queue.map(mergeTrack),
            originalQueue: s.originalQueue?.map(mergeTrack) ?? null,
          };
        }),
    }),
    {
      name: 'sc-player',
      storage: createJSONStorage(() => tauriStorage),
      version: 3,
      partialize: (state) => ({
        volume: state.volume,
        volumeBeforeMute: state.volumeBeforeMute,
        currentTrack: state.currentTrack,
        queue: state.queue,
        originalQueue: state.originalQueue,
        queueIndex: state.queueIndex,
        shuffle: state.shuffle,
        repeat: state.repeat,
      }),
    },
  ),
);
