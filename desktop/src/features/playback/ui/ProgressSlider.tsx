import { throttle } from 'lodash';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { usePlayerStore } from '../../../stores/player.ts';

const ProgressSliderBase = () => {
  const { duration: max, seek: onChange } = usePlayerStore(
    useShallow((s) => ({
      duration: s.duration,
      seek: s.seek,
    })),
  );

  const [value, setValue] = useState(() => usePlayerStore.getState().progress);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);

  useEffect(() => {
    const throttledUpdate = throttle((newProgress: number) => {
      setValue(newProgress);
    }, 60);

    const unsubscribe = usePlayerStore.subscribe((state, prevState) => {
      if (draggingRef.current) return;
      if (state.progress !== prevState.progress) {
        throttledUpdate(state.progress);
      }
    });

    return () => {
      unsubscribe();
      throttledUpdate.cancel();
    };
  }, []);

  const ref = useRef<HTMLDivElement>(null);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);

  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const activeRatio = dragging && hoverRatio !== null ? hoverRatio : ratio;
  const previewRatio = hoverRatio;

  const calcRatio = useCallback((clientX: number) => {
    if (!ref.current) return 0;
    const rect = ref.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const r = calcRatio(e.clientX);
    draggingRef.current = true;
    setDragging(true);
    setHoverRatio(r);
    setValue(r * max);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const r = calcRatio(e.clientX);
    setHoverRatio(r);
    if (draggingRef.current) {
      setValue(r * max);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const r = calcRatio(e.clientX);
    const next = r * max;
    setValue(next);
    onChange(next);
    draggingRef.current = false;
    setDragging(false);
    setHoverRatio(null);
  };

  const handlePointerLeave = () => {
    if (!draggingRef.current) setHoverRatio(null);
  };

  return (
    <div
      ref={ref}
      className="relative h-5 flex items-center cursor-pointer group"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      <div className="absolute inset-x-0 h-[3px] rounded-full bg-white/[0.08] group-hover:h-[5px] transition-all duration-150">
        {previewRatio !== null && !dragging && previewRatio > ratio && (
          <div
            className="absolute top-0 h-full rounded-full bg-white/[0.08] transition-[width] duration-75"
            style={{
              left: `${ratio * 100}%`,
              width: `${(previewRatio - ratio) * 100}%`,
            }}
          />
        )}

        <div
          className={`h-full rounded-full bg-accent ${dragging ? '' : 'transition-[width] duration-50 ease-linear'}`}
          style={{ width: `${activeRatio * 100}%` }}
        />
      </div>

      <div
        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full ${
          dragging
            ? 'w-4 h-4 scale-100 opacity-100 bg-accent shadow-[0_0_12px_var(--color-accent-glow)]'
            : 'w-3 h-3 scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 bg-accent shadow-[0_0_10px_var(--color-accent-glow)]'
        }`}
        style={{ left: `${activeRatio * 100}%` }}
      />
    </div>
  );
};

export const ProgressSlider = React.memo(ProgressSliderBase);
