import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import { create } from 'zustand';
import i18n from '../i18n';
import { expectedDurationMs, getPinnedUrns, saveTrackOffline } from '../lib/cache';
import { forgetPinned, rememberPinned, rememberTracks } from '../lib/offline-index';
import type { Track } from './player';

interface OfflineSavesState {
  progress: Record<string, number>;
  cached: Record<string, boolean>;
}

export const useOfflineSaves = create<OfflineSavesState>(() => ({
  progress: {},
  cached: {},
}));

let listening = false;
const pinnedQueue = new Set<string>();
let pinnedFlush: Promise<void> | null = null;

function onDownloadProgress(urn: string, progress: number) {
  const current = useOfflineSaves.getState().progress[urn];
  if (current === undefined || progress <= current) return;
  useOfflineSaves.setState((s) => ({
    progress: { ...s.progress, [urn]: Math.min(progress, 1) },
  }));
}

function recheckUnsaved() {
  const { cached } = useOfflineSaves.getState();
  for (const [urn, saved] of Object.entries(cached)) {
    if (!saved) void refreshOfflineCached(urn);
  }
}

function listenProgress() {
  if (listening) return;
  listening = true;
  void listen<{ urn: string; progress: number }>('track:download-progress', (event) =>
    onDownloadProgress(event.payload.urn, event.payload.progress),
  );
  void listen<{ phase: string }>('track:bulk-cache-progress', (event) => {
    if (event.payload.phase !== 'start') recheckUnsaved();
  });
}

function setCached(urn: string, cached: boolean) {
  useOfflineSaves.setState((s) => ({ cached: { ...s.cached, [urn]: cached } }));
}

function clearProgress(urn: string) {
  useOfflineSaves.setState((s) => {
    const { [urn]: _, ...rest } = s.progress;
    return { progress: rest };
  });
}

async function flushPinned() {
  await Promise.resolve();
  const urns = [...pinnedQueue];
  pinnedQueue.clear();
  pinnedFlush = null;
  const pinned = new Set(await getPinnedUrns(urns).catch(() => []));
  useOfflineSaves.setState((s) => {
    const cached = { ...s.cached };
    for (const urn of urns) {
      if (!(urn in s.progress)) cached[urn] = pinned.has(urn);
    }
    return { cached };
  });
}

export function refreshOfflineCached(urn: string): Promise<void> {
  listenProgress();
  pinnedQueue.add(urn);
  pinnedFlush ??= flushPinned();
  return pinnedFlush;
}

export async function saveOffline(track: Track, refetch = false): Promise<boolean> {
  const { urn } = track;
  if (urn in useOfflineSaves.getState().progress) return false;
  listenProgress();
  useOfflineSaves.setState((s) => ({ progress: { ...s.progress, [urn]: 0 } }));
  try {
    void rememberTracks([track]);
    if (refetch) await forgetPinned(urn);
    const info = await saveTrackOffline(
      urn,
      refetch,
      expectedDurationMs(track),
      track._scd_meta?.storage_quality,
    );
    setCached(urn, info.pinned);
    if (!info.pinned) throw new Error('track was cached but not pinned');
    void rememberPinned(urn);
    toast.success(i18n.t(refetch ? 'track.offlineRefetched' : 'track.offlineSaved'));
    return true;
  } catch (error) {
    console.warn('[OfflineSave] failed:', error);
    toast.error(i18n.t(refetch ? 'track.offlineRefetchFailed' : 'track.offlineSaveFailed'));
    void refreshOfflineCached(urn);
    return false;
  } finally {
    clearProgress(urn);
  }
}
