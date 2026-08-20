import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getDownloadProgress, getLoadStage, subscribe, type TrackLoadStage } from '../../lib/audio';

/** Smoothed loading state for the player shell. It briefly holds 100% so a
 * completed transfer does not flash away between two paints. */
export function useTrackLoading(): {
  progress: number | null;
  stage: TrackLoadStage;
} {
  const downloadProgress = useSyncExternalStore(subscribe, getDownloadProgress);
  const stage = useSyncExternalStore(subscribe, getLoadStage);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProgressRef = useRef<number | null>(null);
  const [visibleProgress, setVisibleProgress] = useState<number | null>(null);

  useEffect(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (downloadProgress === null) {
      if (lastProgressRef.current !== null && lastProgressRef.current >= 1) {
        hideTimerRef.current = setTimeout(() => {
          setVisibleProgress(null);
          hideTimerRef.current = null;
        }, 320);
      } else {
        setVisibleProgress(null);
      }
      return;
    }

    lastProgressRef.current = downloadProgress;
    setVisibleProgress(downloadProgress);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [downloadProgress]);

  return { progress: visibleProgress, stage };
}

export const loadPercent = (progress: number) =>
  Math.max(1, Math.min(100, Math.round(Math.max(0, Math.min(1, progress)) * 100)));
