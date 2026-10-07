import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import { create } from 'zustand';
import i18n from '../i18n';
import { expectedDurationMs, getCacheInfo, saveTrackOffline } from '../lib/cache';
import { rememberPinned, rememberTracks } from '../lib/offline-index';
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

function onDownloadProgress(urn: string, progress: number) {
  const { progress: running, cached } = useOfflineSaves.getState();
  const current = running[urn];
  if (current !== undefined && progress > current) {
    useOfflineSaves.setState((s) => ({
      progress: { ...s.progress, [urn]: Math.min(progress, 1) },
    }));
  }
  if (progress >= 1 && cached[urn] === false) setCached(urn, true);
}

function listenProgress() {
  if (listening) return;
  listening = true;
  void listen<{ urn: string; progress: number }>('track:download-progress', (event) =>
    onDownloadProgress(event.payload.urn, event.payload.progress),
  );
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

export async function refreshOfflineCached(urn: string) {
  listenProgress();
  const info = await getCacheInfo(urn).catch(() => null);
  setCached(urn, info !== null);
}

export async function saveOffline(track: Track, refetch = false): Promise<boolean> {
  const { urn } = track;
  if (urn in useOfflineSaves.getState().progress) return false;
  listenProgress();
  useOfflineSaves.setState((s) => ({ progress: { ...s.progress, [urn]: 0 } }));
  try {
    void rememberTracks([track]);
    await saveTrackOffline(
      urn,
      refetch,
      expectedDurationMs(track),
      track._scd_meta?.storage_quality,
    );
    setCached(urn, true);
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
