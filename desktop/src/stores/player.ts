import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {createThrottledJsonStorage} from '../lib/tauri-storage';

const PERSISTED_QUEUE_BEHIND = 30;
const PERSISTED_QUEUE_WINDOW = 300;

export interface EnrichmentArtist {
  id: string;
  name: string;
  avatar_url?: string;
  sc_user_id?: string;
  source: string;
  confidence: number;
  verified: boolean;
}

export interface EnrichmentParticipant {
  artist: EnrichmentArtist;
  role: string;
  confidence: number;
}

export interface EnrichmentAlbum {
  id: string;
  title: string;
  year?: number;
  cover_url?: string;
  type: string;
  primary_artist?: EnrichmentArtist;
}

export type TrackAvailability = 'indexed' | 'wanted' | 'not_found';

export interface TrackEnrichment {
  state: string;
  source?: string;
  confidence?: number;
  upload_kind: string;
  availability?: TrackAvailability;
  primary_artist?: EnrichmentArtist;
  participants?: EnrichmentParticipant[];
  album?: EnrichmentAlbum;
  release_year?: number;
  release_date?: string;
  release_source?: string;
}

export interface TrackScdMeta {
    storage_state: 'pending' | 'ok' | 'failed' | 'missing' | 'too_long';
  storage_quality?: 'sq' | 'hq';
    index_state: 'pending' | 'indexed' | 'failed' | 'too_long';
  enrich_state: 'pending' | 'done' | 'failed';
}

export interface Track {
  id: number;
  urn: string;
  title: string;
  duration: number;
  full_duration?: number;
  artwork_url: string | null;
  permalink_url?: string;
  waveform_url?: string;
  genre?: string;
  tag_list?: string;
  description?: string;
  language?: string;
  release_year?: number;
  release_date?: string;
  created_at?: string;
  last_modified?: string;
  sharing?: 'public' | 'private';
  comment_count?: number;
  playback_count?: number;
  likes_count?: number;
  favoritings_count?: number;
  reposts_count?: number;
  user_favorite?: boolean;
  access?: 'playable' | 'preview' | 'blocked';
  publisher_metadata?: {
    isrc?: string;
  };
  user: {
    id: number;
    urn: string;
    username: string;
    avatar_url: string;
    permalink_url?: string;
    verified?: boolean;
    country_code?: string;
    city?: string;
    description?: string;
    followers_count?: number;
    followings_count?: number;
    track_count?: number;
  };
  enrichment?: TrackEnrichment;
  _scd_meta?: TrackScdMeta;
}

type RepeatMode = 'off' | 'one' | 'all';
export type PlaybackQuality = 'hq' | 'sq';

/**
 * A-B loop ("best part" repeat). Bounds are in **source seconds**.
 * `b === null` means point A is set and we're waiting for B — the loop is not
 * active yet. Both set → playback loops the `[a, b]` segment.
 */
export interface AbLoop {
    a: number;
    b: number | null;
}

/** Smallest meaningful loop width / handle gap, in seconds. */
export const AB_MIN_GAP = 0.2;

/**
 * Module-level slot для обработчика "очередь кончилась". Не часть PlayerState,
 * чтобы persist его не сериализовал. Регистрирует lib/queue-autopilot.ts.
 */
let endOfQueueFallback: ((lastTrack: Track) => void) | null = null;
export function setEndOfQueueFallback(fn: (lastTrack: Track) => void): void {
  endOfQueueFallback = fn;
}

/**
 * Слот «началось новое воспроизведение из UI» — сбрасывает контекстный источник
 * дозагрузки очереди (см. lib/queue-continuation.ts), чтобы прошлый контекст
 * (напр. лайки) не дотягивался в чужую очередь. Регистрирует queue-autopilot.ts.
 */
let onPlaybackContextReset: (() => void) | null = null;

export function setPlaybackContextResetHandler(fn: () => void): void {
    onPlaybackContextReset = fn;
}

// Mirrors the Rust DownloadSource enum (serde rename_all = "lowercase").
export type PlaybackSource = 'storage' | 'anon' | 'direct' | 'api';

export const PLAYBACK_RATE_MIN = 0.5;
export const PLAYBACK_RATE_MAX = 2.0;
export const PLAYBACK_RATE_STEP = 0.05;
export const PLAYBACK_RATE_DEFAULT = 1.0;

export const PITCH_SEMITONES_MIN = -12;
export const PITCH_SEMITONES_MAX = 12;
export const PITCH_SEMITONES_STEP = 0.5;

export type PitchControlMode = 'auto' | 'manual';

export function clampPlaybackRate(rate: number): number {
  if (!Number.isFinite(rate)) return PLAYBACK_RATE_DEFAULT;
  return Math.round(Math.max(PLAYBACK_RATE_MIN, Math.min(PLAYBACK_RATE_MAX, rate)) * 100) / 100;
}

export function clampPitchSemitones(semi: number): number {
  if (!Number.isFinite(semi)) return 0;
  return Math.round(Math.max(PITCH_SEMITONES_MIN, Math.min(PITCH_SEMITONES_MAX, semi)) * 2) / 2;
}

/** Pitch the player should treat as effective:
 *  - in 'auto' mode it's the semitone equivalent of the playback rate (rate ↔ pitch coupled)
 *  - in 'manual' mode it's the user-driven slider value
 */
export function getEffectivePitchSemitones(
  rate: number,
  mode: PitchControlMode,
  manual: number,
): number {
  if (mode === 'auto') {
    const safe = Math.max(0.01, rate);
    return clampPitchSemitones((Math.log(safe) / Math.log(2)) * 12);
  }
  return clampPitchSemitones(manual);
}

export function shuffleArray<T>(arr: T[]): void {
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
    /** A-B segment loop for the current track, or null when disabled. */
    abLoop: AbLoop | null;
  playbackQuality: PlaybackQuality | null;
  playbackSource: PlaybackSource | null;

  play: (track: Track, queue?: Track[]) => void;
  playFromQueue: (index: number) => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  resetPlaybackRate: () => void;
  pitchSemitones: number;
  pitchControlMode: PitchControlMode;
  setPitchSemitones: (value: number) => void;
  resetPitchSemitones: () => void;
  setPitchControlMode: (mode: PitchControlMode) => void;
  setQueue: (queue: Track[]) => void;
  addToQueue: (tracks: Track[]) => void;
  addToQueueNext: (tracks: Track[]) => void;
  removeFromQueue: (index: number) => void;
  moveInQueue: (from: number, to: number) => void;
  clearQueue: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
    /** Tap-to-set cycle at the given source-seconds position: set A → set B → clear. */
    cycleAbPoint: (pos: number) => void;
    /** Drag a single loop bound (used by the markers on the progress bar). */
    nudgeAbBound: (which: 'a' | 'b', value: number) => void;
    clearAbLoop: () => void;
  setCurrentTrackAccess: (access: Track['access']) => void;
  replaceTrackMetadata: (track: Track) => void;
  setPlaybackTransport: (quality: PlaybackQuality | null, source: PlaybackSource | null) => void;
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
        abLoop: null,
      playbackQuality: null,
      playbackSource: null,
      playbackRate: PLAYBACK_RATE_DEFAULT,
      pitchSemitones: 0,
      pitchControlMode: 'auto',

      play: (track, queue) => {
          onPlaybackContextReset?.();
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
            // Конец очереди + repeat=off → отдаём управление autopilot'у
            // (см. lib/queue-autopilot.ts). Если он зарегистрирован — он сам
            // дозагрузит треки и пнёт next() ещё раз. Если нет — просто пауза.
            const last = queue[queueIndex];
            if (endOfQueueFallback && last) {
              endOfQueueFallback(last);
              return;
            }
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

      setPlaybackRate: (rate) => set({ playbackRate: clampPlaybackRate(rate) }),
      resetPlaybackRate: () => set({ playbackRate: PLAYBACK_RATE_DEFAULT }),
      setPitchSemitones: (value) => set({ pitchSemitones: clampPitchSemitones(value) }),
      resetPitchSemitones: () => set({ pitchSemitones: 0 }),
      setPitchControlMode: (mode) => set({ pitchControlMode: mode }),

      setQueue: (queue) =>
        set((s) => {
          const idx = s.currentTrack ? queue.findIndex((t) => t.urn === s.currentTrack!.urn) : -1;
          if (s.shuffle && idx >= 0) {
            // Shuffle everything after current track
            const after = [...queue.slice(0, idx), ...queue.slice(idx + 1)];
            shuffleArray(after);
            return {
              queue: [queue[idx], ...after],
              queueIndex: 0,
              originalQueue: [...queue],
            };
          }
          return {
            queue,
            queueIndex: idx >= 0 ? idx : s.queueIndex,
            originalQueue: s.shuffle ? [...queue] : null,
          };
        }),

      addToQueue: (tracks) =>
        set((s) => {
          if (s.shuffle && s.queueIndex >= 0) {
            // Insert new tracks at random positions after current index
            const queue = [...s.queue];
            for (const track of tracks) {
              const pos =
                s.queueIndex + 1 + Math.floor(Math.random() * (queue.length - s.queueIndex));
              queue.splice(pos, 0, track);
            }
            return {
              queue,
              originalQueue: s.originalQueue ? [...s.originalQueue, ...tracks] : null,
            };
          }
          return {
            queue: [...s.queue, ...tracks],
            originalQueue: s.originalQueue ? [...s.originalQueue, ...tracks] : null,
          };
        }),

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

        cycleAbPoint: (pos) =>
            set((s) => {
                const at = Math.max(0, pos);
                const ab = s.abLoop;
                // No loop yet → drop point A.
                if (!ab) return {abLoop: {a: at, b: null}};
                // A set, awaiting B → place the second point, ordering the pair.
                if (ab.b == null) {
                    if (at > ab.a + AB_MIN_GAP) return {abLoop: {a: ab.a, b: at}};
                    if (at < ab.a - AB_MIN_GAP) return {abLoop: {a: at, b: ab.a}};
                    return {abLoop: null}; // too close to A → cancel
                }
                // Active loop → clear.
                return {abLoop: null};
            }),

        nudgeAbBound: (which, value) =>
            set((s) => {
                if (!s.abLoop) return {};
                const {a, b} = s.abLoop;
                if (which === 'a') {
                    const na = Math.max(0, value);
                    if (b != null && na > b - AB_MIN_GAP) return {};
                    return {abLoop: {a: na, b}};
                }
                const nb = Math.max(0, value);
                if (nb < a + AB_MIN_GAP) return {};
                return {abLoop: {a, b: nb}};
            }),

        clearAbLoop: () => set((s) => (s.abLoop ? {abLoop: null} : {})),

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

      setPlaybackTransport: (quality, source) =>
        set((state) =>
          state.playbackQuality === quality && state.playbackSource === source
            ? state
            : { playbackQuality: quality, playbackSource: source },
        ),
    }),
    {
      name: 'sc-player',
      storage: createThrottledJsonStorage(),
      version: 3,
      partialize: (state) => {
        const start = Math.max(0, state.queueIndex - PERSISTED_QUEUE_BEHIND);
        return {
          volume: state.volume,
          volumeBeforeMute: state.volumeBeforeMute,
          currentTrack: state.currentTrack,
          queue: state.queue.slice(start, start + PERSISTED_QUEUE_WINDOW),
          queueIndex: state.queueIndex < 0 ? state.queueIndex : state.queueIndex - start,
          shuffle: state.shuffle,
          repeat: state.repeat,
          playbackRate: state.playbackRate,
          pitchSemitones: state.pitchSemitones,
          pitchControlMode: state.pitchControlMode,
        };
      },
    },
  ),
);
