import { useSyncExternalStore } from 'react';
import type { VideoKind } from '../stores/player';
import { useSettingsStore } from '../stores/settings';
import { CACHE_UNLIMITED } from './cache-limit';
import { getStaticPort } from './constants';
import { trackedInvoke as invoke, logInfo } from './diagnostics';

const TRIM_GAP_MS = 60_000;

const failed = new Map<string, Set<string>>();
const failedListeners = new Set<() => void>();
const NO_FAILS: ReadonlySet<string> = new Set();
let lastTrim = 0;

export async function videoSource(url: string): Promise<string> {
  const name = await invoke<string>('video_fetch', { url });
  trimSoon();
  return `http://127.0.0.1:${getStaticPort()}/video/${name}`;
}

export function loadVideoAhead(url: string): Promise<void> {
  return invoke('video_ahead', { url });
}

export function markVideoFailed(urn: string, kind: VideoKind, reason: string): void {
  const kinds = failed.get(urn) ?? new Set<string>();
  if (kinds.has(kind)) return;
  failed.set(urn, new Set([...kinds, kind]));
  logInfo(`[Video] ${urn} ${kind} failed: ${reason}`);
  for (const listener of failedListeners) listener();
}

export function forgetVideoFails(urn: string): void {
  if (!failed.delete(urn)) return;
  for (const listener of failedListeners) listener();
}

export function useFailedKinds(urn: string | null): ReadonlySet<string> {
  return useSyncExternalStore(subscribeFailed, () => (urn ? failed.get(urn) : null) ?? NO_FAILS);
}

function subscribeFailed(listener: () => void): () => void {
  failedListeners.add(listener);
  return () => failedListeners.delete(listener);
}

export function getVideoCacheSize(): Promise<number> {
  return invoke<number>('video_cache_size');
}

export function clearVideoCache(): Promise<void> {
  return invoke('video_cache_clear');
}

export function enforceVideoCacheLimit(
  limitMb = useSettingsStore.getState().videoCacheLimitMB,
): Promise<unknown> {
  if (limitMb === CACHE_UNLIMITED) return Promise.resolve();
  lastTrim = Date.now();
  return invoke<number>('video_cache_enforce_limit', { limitMb });
}

function trimSoon() {
  if (Date.now() - lastTrim < TRIM_GAP_MS) return;
  void enforceVideoCacheLimit().catch(() => {});
}
