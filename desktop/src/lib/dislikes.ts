import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import type { Track } from '../stores/player';
import { api } from './api';
import { recordEvent } from './events';

const _dislikedUrns = new Map<string, boolean>();
const _listeners = new Set<() => void>();

function notify() {
  for (const l of _listeners) l();
}

export function setDislikedUrn(urn: string, disliked: boolean) {
  if (disliked) {
    _dislikedUrns.set(urn, true);
  } else {
    _dislikedUrns.delete(urn);
  }
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
  const p = api<{ disliked: boolean }>(`/dislikes/status/${encodeURIComponent(urn)}`)
    .then((r) => {
      if (r.disliked) setDislikedUrn(urn, true);
      return r.disliked;
    })
    .catch(() => false)
    .finally(() => {
      _inflightStatus.delete(urn);
    });
  _inflightStatus.set(urn, p);
  return p;
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
  if (_bulkLoaded) return;
  try {
    const r = await api<{ urns: string[] }>('/dislikes/ids');
    for (const urn of r.urns) _dislikedUrns.set(urn, true);
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
  setDislikedUrn(track.urn, nowDisliked);
  if (nowDisliked) recordEvent('dislike', track.urn);

  try {
    await api(`/dislikes/${encodeURIComponent(track.urn)}`, {
      method: nowDisliked ? 'POST' : 'DELETE',
    });
    qc.invalidateQueries({ queryKey: ['dislikes'] });
  } catch {
    setDislikedUrn(track.urn, !nowDisliked);
  }
}
