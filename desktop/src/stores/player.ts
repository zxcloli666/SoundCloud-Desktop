import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Track {
  id: number;
  urn: string;
  title: string;
  duration: number;
  artwork_url: string | null;
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
  user: {
    id: number;
    urn: string;
    username: string;
    avatar_url: string;
    permalink_url: string;
  };
}

type RepeatMode = 'off' | 'one' | 'all';

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
  seekRequest: number | null;

  play: (track: Track, queue?: Track[]) => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  clearSeek: () => void;
  setVolume: (v: number) => void;
  setProgress: (s: number) => void;
  setDuration: (d: number) => void;
  addToQueue: (tracks: Track[]) => void;
  removeFromQueue: (index: number) => void;
  moveInQueue: (from: number, to: number) => void;
  clearQueue: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      queue: [],
      queueIndex: -1,
      isPlaying: false,
      volume: 50,
      progress: 0,
      duration: 0,
      shuffle: false,
      repeat: 'off',
      seekRequest: null,

      play: (track, queue) => {
        console.log(`🏪 [Store] play() -> track: ${track.urn}`);
        if (queue) {
          const idx = queue.findIndex((t) => t.urn === track.urn);
          set({
            currentTrack: track,
            queue,
            queueIndex: idx >= 0 ? idx : 0,
            isPlaying: true,
            progress: 0,
            seekRequest: null,
          });
        } else {
          const { queue: currentQueue } = get();
          set({
            currentTrack: track,
            queue: [...currentQueue, track],
            queueIndex: currentQueue.length,
            isPlaying: true,
            progress: 0,
            seekRequest: null,
          });
        }
      },

      pause: () => {
        console.log(`🏪 [Store] pause()`);
        set({ isPlaying: false });
      },

      resume: () => {
        console.log(`🏪 [Store] resume()`);
        set({ isPlaying: true });
      },

      togglePlay: () => {
        const { isPlaying, currentTrack } = get();
        console.log(`🏪 [Store] togglePlay() -> will be: ${!isPlaying}`);
        if (currentTrack) set({ isPlaying: !isPlaying });
      },

      next: () => {
        console.log(`🏪 [Store] next()`);
        const { queue, queueIndex, repeat, shuffle } = get();
        if (queue.length === 0) return;

        let nextIdx: number;
        if (shuffle) {
          nextIdx = Math.floor(Math.random() * queue.length);
        } else {
          nextIdx = queueIndex + 1;
        }

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
          progress: 0,
          seekRequest: null,
        });
      },

      prev: () => {
        console.log(`🏪 [Store] prev()`);
        const { queue, queueIndex, progress } = get();
        if (progress > 3) {
          console.log(`🏪 [Store] prev() -> rewinding to 0`);
          set({ seekRequest: 0, progress: 0 });
          return;
        }
        const prevIdx = Math.max(0, queueIndex - 1);
        set({
          currentTrack: queue[prevIdx],
          queueIndex: prevIdx,
          isPlaying: true,
          progress: 0,
          seekRequest: null,
        });
      },

      seek: (seconds) => {
        console.log(`🏪 [Store] seek(${seconds})`);
        set({ seekRequest: seconds, progress: seconds });
      },

      clearSeek: () => {
        console.log(`🏪 [Store] clearSeek()`);
        set({ seekRequest: null });
      },

      setVolume: (v) => set({ volume: Math.round(Math.max(0, Math.min(200, v))) }),
      setProgress: (s) => set({ progress: s }),
      setDuration: (d) => set({ duration: d }),

      addToQueue: (tracks) => set((s) => ({ queue: [...s.queue, ...tracks] })),

      removeFromQueue: (index) =>
        set((s) => {
          const queue = s.queue.filter((_, i) => i !== index);
          const queueIndex =
            index < s.queueIndex
              ? s.queueIndex - 1
              : index === s.queueIndex
                ? Math.min(s.queueIndex, queue.length - 1)
                : s.queueIndex;
          return { queue, queueIndex };
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

      clearQueue: () => set({ queue: [], queueIndex: -1 }),
      toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
      toggleRepeat: () =>
        set((s) => ({
          repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off',
        })),
    }),
    {
      name: 'sc-player',
      version: 2,
      partialize: (state) => ({
        volume: state.volume,
        currentTrack: state.currentTrack,
        queue: state.queue,
        queueIndex: state.queueIndex,
        shuffle: state.shuffle,
        repeat: state.repeat,
      }),
      migrate: (persisted: unknown) => {
        const state = persisted as Record<string, unknown>;
        state.volume = 50;
        return state as unknown as PlayerState;
      },
    },
  ),
);
