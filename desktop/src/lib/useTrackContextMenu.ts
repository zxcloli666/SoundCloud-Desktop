import type React from 'react';
import { useCallback, useRef } from 'react';
import type { Track } from '../stores/player';
import { useTrackMenuStore } from '../stores/trackMenu';

export function openTrackMenu(e: React.MouseEvent<HTMLElement>, track: Track, queueIndex?: number) {
  e.preventDefault();
  e.stopPropagation();
  const fromKeyboard = e.clientX === 0 && e.clientY === 0;
  const rect = e.currentTarget.getBoundingClientRect();
  useTrackMenuStore.getState().open({
    track,
    queueIndex,
    x: fromKeyboard ? rect.left + 16 : e.clientX,
    y: fromKeyboard ? rect.top + rect.height / 2 : e.clientY,
  });
}

export function useTrackContextMenu(track: Track, queueIndex?: number) {
  const ref = useRef({ track, queueIndex });
  ref.current = { track, queueIndex };

  return useCallback(
    (e: React.MouseEvent<HTMLElement>) =>
      openTrackMenu(e, ref.current.track, ref.current.queueIndex),
    [],
  );
}
