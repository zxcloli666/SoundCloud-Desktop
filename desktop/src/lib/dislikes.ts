import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import type { Track } from '../stores/player';
import {
  getLocalRecommendationPreference,
  setLocalRecommendationPreference,
} from '../stores/recommendation-taste';
import { api } from './api';
import { publishSoundWaveOutcome, recordNetworkRecommendationEvent } from './events';
import { isUrnLiked } from './likes';

const _dislikedUrns = new Map<string, boolean>();
const _listeners = new Set<() => void>();
let _version = 0;
let _ownerUrn: string | null | undefined;
let _accountGeneration = 0;

function notify() {
  _version += 1;
  for (const l of _listeners) l();
}

export function setDislikedUrn(urn: string, disliked: boolean) {
  const wasDisliked = _dislikedUrns.has(urn);
  if (wasDisliked === disliked) return;
  if (disliked) {
    _dislikedUrns.set(urn, true);
  } else {
    _dislikedUrns.delete(urn);
  }
  notify();
}

/** Reactive invalidation token for bulk loads and imperative recommendation filters. */
export function useDislikeVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      _listeners.add(cb);
      return () => _listeners.delete(cb);
    },
    () => _version,
  );
}

/** Clear session-global dislike state before loading another account. */
export function setDislikeAccount(ownerUrn: string | null): void {
  const normalized = ownerUrn?.trim() || null;
  if (_ownerUrn === normalized) return;
  const hadOwner = _ownerUrn !== undefined;
  _ownerUrn = normalized;
  // The first resolved owner belongs to the current bootstrap session; keep
  // any statuses that individual hooks may already have fetched for it.
  if (!hadOwner) return;
  _accountGeneration += 1;
  _bulkLoaded = false;
  _inflightStatus.clear();
  _dislikedUrns.clear();
  notify();
}

export function isUrnDisliked(urn: string): boolean {
  return _dislikedUrns.has(urn);
}

export function useDisliked(urn: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      _listeners.add(cb);
      return () => _listeners.delete(cb);
    },
    () => _dislikedUrns.has(urn),
  );
}

const _inflightStatus = new Map<string, Promise<boolean>>();

/** Fetch dislike status once per URN session-wide. Result is cached in the global store. */
export async function fetchDislikeStatus(urn: string): Promise<boolean> {
  if (_dislikedUrns.has(urn)) return true;
  const existing = _inflightStatus.get(urn);
  if (existing) return existing;
  const generation = _accountGeneration;
  let request: Promise<boolean>;
  request = api<{ disliked: boolean }>(`/dislikes/status/${encodeURIComponent(urn)}`)
    .then((r) => {
      if (generation !== _accountGeneration) return false;
      if (r.disliked) setDislikedUrn(urn, true);
      return r.disliked;
    })
    .catch(() => false)
    .finally(() => {
      if (_inflightStatus.get(urn) === request) _inflightStatus.delete(urn);
    });
  _inflightStatus.set(urn, request);
  return request;
}

/** Hook: subscribe to dislike state and trigger fetch on mount. */
export function useDislikeStatus(urn: string | undefined): boolean {
  const disliked = useSyncExternalStore(
    (cb) => {
      _listeners.add(cb);
      return () => _listeners.delete(cb);
    },
    () => (urn ? _dislikedUrns.has(urn) : false),
  );
  useEffect(() => {
    if (urn) fetchDislikeStatus(urn);
  }, [urn]);
  return disliked;
}

/**
 * Загружает все ID дизлайкнутых треков юзера в локальный кеш.
 * Вызывается один раз после авторизации, чтобы автоскип в audio.ts
 * мог работать синхронно без запросов к бэку.
 */
let _bulkLoaded = false;
export async function loadAllDislikedIds(): Promise<void> {
  if (_bulkLoaded || !_ownerUrn) return;
  const generation = _accountGeneration;
  try {
    const r = await api<{ ids: string[] }>('/dislikes/ids');
    if (generation !== _accountGeneration) return;
    for (const id of r.ids) {
      const urn = id.startsWith('soundcloud:tracks:') ? id : `soundcloud:tracks:${id}`;
      _dislikedUrns.set(urn, true);
    }
    _bulkLoaded = true;
    notify();
  } catch {
    /* ignore — fallback на per-track fetchDislikeStatus */
  }
}

export async function toggleDislike(
  qc: QueryClient,
  track: Track,
  nowDisliked: boolean,
): Promise<void> {
  const previousPreference = getLocalRecommendationPreference(track.urn);
  const nextPreference = nowDisliked
    ? 'disliked'
    : isUrnLiked(track.urn) || track.user_favorite
      ? 'liked'
      : null;
  setDislikedUrn(track.urn, nowDisliked);
  setLocalRecommendationPreference(track, nextPreference);

  try {
    if (nowDisliked) {
      await api(`/dislikes/${encodeURIComponent(track.urn)}`, {
        method: 'POST',
        body: JSON.stringify(track),
      });
    } else {
      await api(`/dislikes/${encodeURIComponent(track.urn)}`, { method: 'DELETE' });
    }
    if (nowDisliked) {
      publishSoundWaveOutcome('dislike', track.urn);
      recordNetworkRecommendationEvent('dislike', track.urn);
    }
    qc.invalidateQueries({ queryKey: ['dislikes'] });
  } catch {
    setDislikedUrn(track.urn, !nowDisliked);
    setLocalRecommendationPreference(track, previousPreference);
  }
}
