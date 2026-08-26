import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SoundWaveEvent } from '../lib/events';
import { decayRecommendationScore } from '../lib/recommendation-score';
import { createThrottledJsonStorage } from '../lib/tauri-storage';
import type { Track } from './player';

const MAX_TRACK_SIGNALS = 800;
const MAX_CLUSTER_SIGNALS = 32;
const SCORE_MIN = -8;
const SCORE_MAX = 8;

export type LocalExplicitPreference = 'liked' | 'disliked' | null;

export interface LocalTrackTasteSignal {
  score: number;
  updatedAt: number;
  artistUrn?: string;
  genre?: string;
  completes: number;
  earlySkips: number;
  likes: number;
  dislikes: number;
  /** Implicit listening behaviour, kept separate so explicit choices are reversible. */
  behaviorScore: number;
  /** Active like/dislike contribution. Unlike/undislike removes exactly this part. */
  preferenceScore: number;
  explicitPreference: LocalExplicitPreference;
}

export interface LocalClusterTasteSignal {
  score: number;
  updatedAt: number;
  clicks: number;
  completes: number;
}

interface RecommendationTastePersistedState {
  ownerUrn: string | null;
  tracks: Record<string, LocalTrackTasteSignal>;
  clusters: Record<string, LocalClusterTasteSignal>;
  recentTracks: Track[];
}

interface RecommendationTasteState extends RecommendationTastePersistedState {
  /** False until the authenticated account has been matched to persisted data. */
  ownerReady: boolean;
  setOwner: (ownerUrn: string | null) => void;
  setOwnerPending: () => void;
  reset: () => void;
  recordStart: (track: Track) => void;
  recordTrack: (
    event: SoundWaveEvent,
    urn: string,
    positionPct?: number,
    track?: Track | null,
  ) => void;
  setPreference: (track: Track, preference: LocalExplicitPreference) => void;
  recordCluster: (cluster: string, type: 'click' | 'complete') => void;
}

function clampScore(score: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, score));
}

function eventDelta(event: SoundWaveEvent, positionPct?: number): number {
  switch (event) {
    case 'like':
    case 'local_like':
      return 3;
    case 'playlist_add':
      return 2;
    case 'full_play':
      return 1.4;
    case 'dislike':
      return -6;
    case 'skip': {
      const position = positionPct ?? 0;
      if (position < 0.15) return -2.4;
      if (position < 0.5) return -1.1;
      return -0.25;
    }
  }
}

function explicitScore(preference: LocalExplicitPreference): number {
  if (preference === 'liked') return 3;
  if (preference === 'disliked') return -6;
  return 0;
}

function normalizedOwner(ownerUrn: string | null): string | null {
  return ownerUrn?.trim() || null;
}

function agedParts(
  previous: LocalTrackTasteSignal | undefined,
  now: number,
): { behaviorScore: number; preferenceScore: number } {
  if (!previous) return { behaviorScore: 0, preferenceScore: 0 };
  const legacyBehavior = Number.isFinite(previous.behaviorScore)
    ? previous.behaviorScore
    : previous.score;
  const legacyPreference = Number.isFinite(previous.preferenceScore)
    ? previous.preferenceScore
    : 0;
  return {
    behaviorScore: decayRecommendationScore(legacyBehavior, previous.updatedAt, now),
    preferenceScore: decayRecommendationScore(legacyPreference, previous.updatedAt, now),
  };
}

function emptyTaste(ownerUrn: string | null, ownerReady: boolean) {
  return {
    ownerUrn,
    ownerReady,
    tracks: {},
    clusters: {},
    recentTracks: [],
  };
}

function withSignalMetadata(
  previous: LocalTrackTasteSignal | undefined,
  track?: Track | null,
) {
  return {
    artistUrn: track?.user?.urn || previous?.artistUrn,
    genre: track?.genre?.trim().toLowerCase() || previous?.genre,
  };
}

function boundedRecord<T extends { updatedAt: number }>(
  record: Record<string, T>,
  maxSize: number,
): Record<string, T> {
  const entries = Object.entries(record);
  if (entries.length <= maxSize) return record;
  entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt);
  return Object.fromEntries(entries.slice(0, maxSize));
}

export const useRecommendationTasteStore = create<RecommendationTasteState>()(
  persist(
    (set, get) => ({
      ownerUrn: null,
      ownerReady: false,
      tracks: {},
      clusters: {},
      recentTracks: [],
      setOwner: (rawOwnerUrn) => {
        const ownerUrn = normalizedOwner(rawOwnerUrn);
        set((state) => {
          if (state.ownerUrn === ownerUrn) return { ownerReady: true };
          return emptyTaste(ownerUrn, true);
        });
      },
      setOwnerPending: () => set({ ownerReady: false }),
      reset: () => set(emptyTaste(null, true)),
      recordStart: (track) => {
        if (!track?.urn || !get().ownerReady || !get().ownerUrn) return;
        set((state) => {
          const now = Date.now();
          const previous = state.tracks[track.urn];
          const parts = agedParts(previous, now);
          const signal: LocalTrackTasteSignal = {
            score: clampScore(parts.behaviorScore + parts.preferenceScore),
            updatedAt: now,
            ...withSignalMetadata(previous, track),
            completes: previous?.completes ?? 0,
            earlySkips: previous?.earlySkips ?? 0,
            likes: previous?.likes ?? 0,
            dislikes: previous?.dislikes ?? 0,
            behaviorScore: parts.behaviorScore,
            preferenceScore: parts.preferenceScore,
            explicitPreference: previous?.explicitPreference ?? null,
          };
          return {
            tracks: boundedRecord(
              { ...state.tracks, [track.urn]: signal },
              MAX_TRACK_SIGNALS,
            ),
            recentTracks: [
              { ...track, user: { ...track.user } },
              ...state.recentTracks.filter((item) => item.urn !== track.urn),
            ].slice(0, 60),
          };
        });
      },
      recordTrack: (event, urn, positionPct, track) => {
        if (!urn || !get().ownerReady || !get().ownerUrn) return;
        set((state) => {
          const now = Date.now();
          const previous = state.tracks[urn];
          const parts = agedParts(previous, now);
          const preference =
            event === 'like' || event === 'local_like'
              ? 'liked'
              : event === 'dislike'
                ? 'disliked'
                : (previous?.explicitPreference ?? null);
          const nextBehavior =
            event === 'like' || event === 'local_like' || event === 'dislike'
              ? parts.behaviorScore
              : clampScore(parts.behaviorScore + eventDelta(event, positionPct));
          const nextPreference =
            event === 'like' || event === 'local_like' || event === 'dislike'
              ? explicitScore(preference)
              : parts.preferenceScore;
          const next: LocalTrackTasteSignal = {
            score: clampScore(nextBehavior + nextPreference),
            updatedAt: now,
            ...withSignalMetadata(previous, track),
            completes: (previous?.completes ?? 0) + (event === 'full_play' ? 1 : 0),
            earlySkips:
              (previous?.earlySkips ?? 0) +
              (event === 'skip' && (positionPct ?? 0) < 0.25 ? 1 : 0),
            likes:
              (previous?.likes ?? 0) +
              (event === 'like' || event === 'local_like' ? 1 : 0),
            dislikes: (previous?.dislikes ?? 0) + (event === 'dislike' ? 1 : 0),
            behaviorScore: nextBehavior,
            preferenceScore: nextPreference,
            explicitPreference: preference,
          };
          return {
            tracks: boundedRecord({ ...state.tracks, [urn]: next }, MAX_TRACK_SIGNALS),
          };
        });
      },
      setPreference: (track, preference) => {
        if (!track?.urn || !get().ownerReady || !get().ownerUrn) return;
        set((state) => {
          const now = Date.now();
          const previous = state.tracks[track.urn];
          const parts = agedParts(previous, now);
          const preferenceScore = explicitScore(preference);
          const next: LocalTrackTasteSignal = {
            score: clampScore(parts.behaviorScore + preferenceScore),
            updatedAt: now,
            ...withSignalMetadata(previous, track),
            completes: previous?.completes ?? 0,
            earlySkips: previous?.earlySkips ?? 0,
            likes: previous?.likes ?? 0,
            dislikes: previous?.dislikes ?? 0,
            behaviorScore: parts.behaviorScore,
            preferenceScore,
            explicitPreference: preference,
          };
          return {
            tracks: boundedRecord(
              { ...state.tracks, [track.urn]: next },
              MAX_TRACK_SIGNALS,
            ),
          };
        });
      },
      recordCluster: (cluster, type) => {
        if (!cluster || !get().ownerReady || !get().ownerUrn) return;
        set((state) => {
          const now = Date.now();
          const previous = state.clusters[cluster];
          const previousScore = previous
            ? decayRecommendationScore(previous.score, previous.updatedAt, now)
            : 0;
          const next: LocalClusterTasteSignal = {
            score: clampScore(previousScore + (type === 'complete' ? 1.2 : 0.3)),
            updatedAt: now,
            clicks: (previous?.clicks ?? 0) + (type === 'click' ? 1 : 0),
            completes: (previous?.completes ?? 0) + (type === 'complete' ? 1 : 0),
          };
          return {
            clusters: boundedRecord(
              { ...state.clusters, [cluster]: next },
              MAX_CLUSTER_SIGNALS,
            ),
          };
        });
      },
    }),
    {
      name: 'sonveil-recommendation-taste',
      storage: createThrottledJsonStorage<RecommendationTastePersistedState>(1000),
      version: 2,
      migrate: (persistedState) => {
        const previous = (persistedState ?? {}) as Partial<RecommendationTastePersistedState> & {
          tracks?: Record<string, Partial<LocalTrackTasteSignal>>;
        };
        const tracks: Record<string, LocalTrackTasteSignal> = {};
        for (const [urn, raw] of Object.entries(previous.tracks ?? {})) {
          const score = Number.isFinite(raw.score) ? (raw.score as number) : 0;
          tracks[urn] = {
            score,
            updatedAt: Number.isFinite(raw.updatedAt) ? (raw.updatedAt as number) : Date.now(),
            artistUrn: raw.artistUrn,
            genre: raw.genre,
            completes: raw.completes ?? 0,
            earlySkips: raw.earlySkips ?? 0,
            likes: raw.likes ?? 0,
            dislikes: raw.dislikes ?? 0,
            behaviorScore: Number.isFinite(raw.behaviorScore)
              ? (raw.behaviorScore as number)
              : score,
            preferenceScore: Number.isFinite(raw.preferenceScore)
              ? (raw.preferenceScore as number)
              : 0,
            explicitPreference: raw.explicitPreference ?? null,
          };
        }
        return {
          // Version 1 had no owner. Dropping its identity is deliberate: the
          // next validated account will clear unowned legacy taste data.
          ownerUrn: previous.ownerUrn ?? null,
          tracks,
          clusters: previous.clusters ?? {},
          recentTracks: previous.recentTracks ?? [],
        };
      },
      partialize: (state) => ({
        ownerUrn: state.ownerUrn,
        tracks: state.tracks,
        clusters: state.clusters,
        recentTracks: state.recentTracks,
      }),
    },
  ),
);

let expectedOwnerUrn: string | null | undefined;

function enforceExpectedOwner(): void {
  if (expectedOwnerUrn === undefined) return;
  useRecommendationTasteStore.getState().setOwner(expectedOwnerUrn);
}

useRecommendationTasteStore.persist.onFinishHydration(enforceExpectedOwner);

export function setRecommendationTasteOwner(ownerUrn: string): void {
  expectedOwnerUrn = normalizedOwner(ownerUrn);
  enforceExpectedOwner();
}

export function setRecommendationTasteOwnerPending(): void {
  expectedOwnerUrn = undefined;
  useRecommendationTasteStore.getState().setOwnerPending();
}

export function resetRecommendationTaste(): void {
  expectedOwnerUrn = null;
  useRecommendationTasteStore.getState().reset();
}

export function recordLocalRecommendationEvent(
  event: SoundWaveEvent,
  urn: string,
  positionPct?: number,
  track?: Track | null,
): void {
  useRecommendationTasteStore.getState().recordTrack(event, urn, positionPct, track);
}

export function recordLocalClusterFeedback(cluster: string, type: 'click' | 'complete'): void {
  useRecommendationTasteStore.getState().recordCluster(cluster, type);
}

export function setLocalRecommendationPreference(
  track: Track,
  preference: LocalExplicitPreference,
): void {
  useRecommendationTasteStore.getState().setPreference(track, preference);
}

export function getLocalRecommendationPreference(urn: string): LocalExplicitPreference {
  return useRecommendationTasteStore.getState().tracks[urn]?.explicitPreference ?? null;
}

export function recordLocalPlayStart(track: Track): void {
  useRecommendationTasteStore.getState().recordStart(track);
}
