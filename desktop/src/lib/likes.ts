import type { QueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { useAuthStore } from '../stores/auth';
import type { Track } from '../stores/player';
import {
  getLocalRecommendationPreference,
  setLocalRecommendationPreference,
  type LocalExplicitPreference,
} from '../stores/recommendation-taste';
import { publishSoundWaveOutcome, recordNetworkRecommendationEvent } from './events';

interface PagedTracks {
  collection: Track[];
  page: number;
  page_size: number;
  has_more: boolean;
}

/* ── Global liked URNs store ─────────────────────────────── */

const _likedUrns = new Map<string, boolean>();
const _listeners = new Map<string, Set<() => void>>();
let _ownerUrn: string | null | undefined;
const _preferenceBeforeOptimistic = new Map<string, LocalExplicitPreference>();
const PREFERENCE_ROLLBACK_CAP = 256;

function notify(urn: string) {
  for (const listener of _listeners.get(urn) ?? []) listener();
}

/** Sync liked URNs from loaded liked tracks (called on every useLikedTracks data change) */
export function initLikedUrns(tracks: Track[]) {
  const changed: string[] = [];
  for (const t of tracks) {
    if (!_likedUrns.has(t.urn)) {
      _likedUrns.set(t.urn, true);
      changed.push(t.urn);
    }
  }
  for (const urn of changed) notify(urn);
}

/** Set like status for a track URN */
export function setLikedUrn(urn: string, liked: boolean) {
  if (_likedUrns.has(urn) === liked) return;
  if (liked) {
    _likedUrns.set(urn, true);
  } else {
    _likedUrns.delete(urn);
  }
  notify(urn);
}

/** Drop the module-level like mirror when the authenticated account changes. */
export function setLikeAccount(ownerUrn: string | null): void {
  const normalized = ownerUrn?.trim() || null;
  if (_ownerUrn === normalized) return;
  const hadOwner = _ownerUrn !== undefined;
  _ownerUrn = normalized;
  _preferenceBeforeOptimistic.clear();
  // On the first account resolution, hooks may already have populated the
  // mirror for that same session. Preserve it; later transitions are real
  // account changes and must clear cross-account state.
  if (!hadOwner) return;
  const changed = [..._likedUrns.keys()];
  _likedUrns.clear();
  for (const urn of changed) notify(urn);
}

/** Check if a track URN is liked */
export function isUrnLiked(urn: string): boolean {
  return _likedUrns.has(urn);
}

/** React hook — subscribes to like status for a specific URN */
export function useLiked(urn: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const listeners = _listeners.get(urn) ?? new Set<() => void>();
      listeners.add(cb);
      _listeners.set(urn, listeners);
      return () => {
        listeners.delete(cb);
        if (listeners.size === 0) _listeners.delete(urn);
      };
    },
    () => _likedUrns.has(urn),
  );
}

/* ── Liked-tracks counter ───────────────────────────────── */

interface UserLikeCounters {
  likes_count?: number | null;
  public_favorites_count?: number | null;
}

export function likedTracksCount(user: UserLikeCounters | null | undefined): number | undefined {
  return user?.likes_count ?? user?.public_favorites_count ?? undefined;
}

/* ── Optimistic toggle (TanStack Query cache) ───────────── */

export function optimisticToggleLike(
  qc: QueryClient,
  track: Track,
  nowLiked: boolean,
  options: { emitEvent?: boolean } = {},
) {
  // Update global liked URNs
  setLikedUrn(track.urn, nowLiked);

  // Explicit preference is stateful rather than additive, so unlike and failed
  // optimistic mutations can restore it exactly without erasing play signals.
  let preference: LocalExplicitPreference;
  if (options.emitEvent === false && _preferenceBeforeOptimistic.has(track.urn)) {
    preference = _preferenceBeforeOptimistic.get(track.urn) ?? null;
    _preferenceBeforeOptimistic.delete(track.urn);
  } else {
    _preferenceBeforeOptimistic.delete(track.urn);
    _preferenceBeforeOptimistic.set(track.urn, getLocalRecommendationPreference(track.urn));
    while (_preferenceBeforeOptimistic.size > PREFERENCE_ROLLBACK_CAP) {
      const oldest = _preferenceBeforeOptimistic.keys().next().value;
      if (typeof oldest !== 'string') break;
      _preferenceBeforeOptimistic.delete(oldest);
    }
    preference = nowLiked ? 'liked' : null;
  }
  setLocalRecommendationPreference(track, preference);
  // Update favorites count in auth store
  const { user } = useAuthStore.getState();
  if (user) {
    const delta = nowLiked ? 1 : -1;
    useAuthStore.setState({
      user:
        user.likes_count != null
          ? { ...user, likes_count: user.likes_count + delta }
          : { ...user, public_favorites_count: (user.public_favorites_count ?? 0) + delta },
    });
  }

  // Update all liked tracks infinite queries
  qc.setQueriesData<{ pages: PagedTracks[]; pageParams: unknown[] }>(
    { queryKey: ['me', 'likes', 'tracks'] },
    (old) => {
      if (!old?.pages) return old;
      if (nowLiked) {
        const pages = [...old.pages];
        pages[0] = {
          ...pages[0],
          collection: [track, ...pages[0].collection.filter((t) => t.urn !== track.urn)],
        };
        return { ...old, pages };
      }
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          collection: page.collection.filter((t) => t.urn !== track.urn),
        })),
      };
    },
  );

  // Update single track query
  qc.setQueryData<Track>(['track', track.urn], (old) => {
    if (!old) return old;
    return { ...old, user_favorite: nowLiked };
  });

  // Delayed refetch for single track (eventual consistency).
  // Liked tracks list is NOT invalidated — the optimistic cache update above
  // is already correct, and SC API is eventually consistent so early refetch
  // would overwrite optimistic data with stale results.
  setTimeout(() => {
    qc.invalidateQueries({ queryKey: ['track', track.urn], exact: true });
  }, 5000);
}

/** Finalize a successful server mutation; failed optimistic likes never emit telemetry. */
export function commitOptimisticLike(urn: string, nowLiked: boolean): void {
  _preferenceBeforeOptimistic.delete(urn);
  if (nowLiked) {
    publishSoundWaveOutcome('like', urn);
    recordNetworkRecommendationEvent('like', urn);
  }
}
