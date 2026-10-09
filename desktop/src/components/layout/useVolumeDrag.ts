import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { fineDragVolume, snapVolume, VOLUME_MAX } from '../../lib/volume';
import { usePlayerStore } from '../../stores/player';

export function useVolumeDrag(vertical: boolean) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const fineRef = useRef(false);
  const anchorRef = useRef<{ value: number; volume: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fine, setFine] = useState(false);

  const syncModifier = useCallback((e: React.PointerEvent) => {
    if (e.shiftKey === fineRef.current) return;
    fineRef.current = e.shiftKey;
    anchorRef.current = null;
    setFine(e.shiftKey);
  }, []);

  const onPointerDownCapture = useCallback(
    (e: React.PointerEvent) => {
      anchorRef.current = null;
      syncModifier(e);
      setDragging(true);
    },
    [syncModifier],
  );

  const endDrag = useCallback(() => {
    anchorRef.current = null;
    setDragging(false);
  }, []);

  const onValueChange = useCallback(
    ([value]: number[]) => {
      const { volume, setVolume } = usePlayerStore.getState();
      if (fineRef.current) {
        anchorRef.current ??= { value, volume };
        setVolume(fineDragVolume(anchorRef.current.volume, anchorRef.current.value, value));
        return;
      }
      const el = rootRef.current;
      const size = el ? (vertical ? el.clientHeight : el.clientWidth) : 0;
      setVolume(size > 0 ? snapVolume(value, VOLUME_MAX / size) : value);
    },
    [vertical],
  );

  return {
    rootRef,
    dragging,
    fine: dragging && fine,
    onValueChange,
    rootHandlers: {
      onPointerDownCapture,
      onPointerMoveCapture: syncModifier,
      onPointerUp: endDrag,
      onLostPointerCapture: endDrag,
    },
  };
}
