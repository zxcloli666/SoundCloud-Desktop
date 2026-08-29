import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getDownloadProgress, getLoadStage, subscribe, type TrackLoadStage } from '../../lib/audio';

interface TrackLoadingSnapshot {
  downloadProgress: number | null;
  stage: TrackLoadStage;
}

let loadingSnapshot: TrackLoadingSnapshot = {
  downloadProgress: getDownloadProgress(),
  stage: getLoadStage(),
};

function getLoadingSnapshot(): TrackLoadingSnapshot {
  const downloadProgress = getDownloadProgress();
  const stage = getLoadStage();
  if (downloadProgress !== loadingSnapshot.downloadProgress || stage !== loadingSnapshot.stage) {
    loadingSnapshot = { downloadProgress, stage };
  }
  return loadingSnapshot;
}

/** Smoothed loading state for the player shell. It briefly holds 100% so a
 * completed transfer does not flash away between two paints. */
export function useTrackLoading(): {
  progress: number | null;
  stage: TrackLoadStage;
} {
  const { downloadProgress, stage } = useSyncExternalStore(subscribe, getLoadingSnapshot);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProgressRef = useRef<number | null>(null);
  const [visibleProgress, setVisibleProgress] = useState<number | null>(null);

  useEffect(() => {
    const clearHideTimer = () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    clearHideTimer();

    if (downloadProgress === null) {
      if (lastProgressRef.current !== null && lastProgressRef.current >= 1) {
        hideTimerRef.current = setTimeout(() => {
          setVisibleProgress(null);
          hideTimerRef.current = null;
        }, 320);
      } else {
        setVisibleProgress(null);
      }
      return clearHideTimer;
    }

    lastProgressRef.current = downloadProgress;
    setVisibleProgress(downloadProgress);

    return clearHideTimer;
  }, [downloadProgress]);

  return { progress: visibleProgress, stage };
}

export const loadPercent = (progress: number) =>
  Math.max(1, Math.min(100, Math.round(Math.max(0, Math.min(1, progress)) * 100)));
