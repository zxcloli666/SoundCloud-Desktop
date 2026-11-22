import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getDownloadProgress, subscribe } from '../../../lib/audio';

export function useLoadProgress(): number | null {
  const downloadProgress = useSyncExternalStore(subscribe, getDownloadProgress);
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

  return visibleProgress;
}

export const loadPercent = (progress: number) =>
  Math.min(100, Math.round(Math.max(0, Math.min(1, progress)) * 100));

export const DockLoadingRing = React.memo(({ progress }: { progress: number | null }) => {
  if (progress == null) return null;
  return (
    <svg className="npb-loadring" aria-hidden="true">
      <rect className="npb-loadring-track" width="100%" height="100%" rx={28} />
      <rect
        className="npb-loadring-fill"
        width="100%"
        height="100%"
        rx={28}
        pathLength={100}
        style={{ strokeDashoffset: 100 - loadPercent(progress) }}
      />
    </svg>
  );
});
