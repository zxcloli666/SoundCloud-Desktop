import * as Slider from '@radix-ui/react-slider';
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getCurrentTime, getDuration, seek, subscribe } from '../../../lib/audio';
import { formatTime } from '../../../lib/formatters';
import { useWheelSeek } from '../../../lib/useWheelSeek';
import { AbLoopOverlay, tipClass } from './AbLoopOverlay';

function paintProgress(
  range: HTMLSpanElement | null,
  thumb: HTMLSpanElement | null,
  seconds: number,
) {
  const d = getDuration();
  const pct = d > 0 ? (seconds / d) * 100 : 0;
  if (range) range.style.right = `${100 - pct}%`;
  const thumbWrapper = thumb?.parentElement;
  if (thumbWrapper) thumbWrapper.style.left = `${pct}%`;
}

export const ProgressSlider = React.memo(() => {
  const duration = useSyncExternalStore(subscribe, getDuration);

  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const [syncedValue, setSyncedValue] = useState(0);

  const draggingRef = useRef(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const rangeRef = useRef<HTMLSpanElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);

  const wheelTargetRef = useWheelSeek(rootRef, tipRef, {
    position: getCurrentTime,
    duration: getDuration,
    seek,
    preview: (seconds) => paintProgress(rangeRef.current, thumbRef.current, seconds),
    dragging: () => draggingRef.current,
  });

  useEffect(() => {
    return subscribe(() => {
      if (draggingRef.current || wheelTargetRef.current !== null) return;
      paintProgress(rangeRef.current, thumbRef.current, getCurrentTime());
    });
  }, [wheelTargetRef]);

  const displayValue = dragging ? dragValue : syncedValue;

  const pendingCommitRef = useRef<number | null>(null);

  const onValueChange = useCallback(([v]: number[]) => {
    setDragValue(v);
    pendingCommitRef.current = v;
    if (!draggingRef.current) {
      draggingRef.current = true;
      setDragging(true);

      const resetDrag = () => {
        window.removeEventListener('pointerup', resetDrag);
        window.removeEventListener('pointercancel', resetDrag);
        requestAnimationFrame(() => {
          if (draggingRef.current) {
            const val = pendingCommitRef.current;
            if (val != null) seek(val);
            draggingRef.current = false;
            setDragging(false);
            setSyncedValue(val ?? 0);
          }
        });
      };
      window.addEventListener('pointerup', resetDrag);
      window.addEventListener('pointercancel', resetDrag);
    }
  }, []);

  const onValueCommit = useCallback(([v]: number[]) => {
    seek(v);
    draggingRef.current = false;
    pendingCommitRef.current = null;
    setDragging(false);
    setSyncedValue(v);
  }, []);

  return (
    <Slider.Root
      ref={rootRef}
      data-ui="progress"
      className="relative flex items-center w-full h-5 cursor-pointer group select-none touch-none"
      value={[displayValue]}
      max={duration || 1}
      step={0.1}
      onValueChange={onValueChange}
      onValueCommit={onValueCommit}
    >
      <Slider.Track className="relative h-[3px] grow rounded-full bg-ink/[0.08] group-hover:h-[5px] transition-all duration-150">
        <Slider.Range
          ref={rangeRef}
          className="absolute h-full rounded-full bg-accent will-change-transform"
        />
      </Slider.Track>
      <Slider.Thumb
        ref={thumbRef}
        className="block w-3 h-3 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent-glow)] scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-150 outline-none will-change-transform"
      />
      <AbLoopOverlay duration={duration} />
      <span ref={tipRef} className={tipClass} />
    </Slider.Root>
  );
});

export const ProgressTime = React.memo(() => {
  const currentSecond = useSyncExternalStore(subscribe, () => Math.floor(getCurrentTime()));
  const duration = useSyncExternalStore(subscribe, getDuration);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-ink-50 tabular-nums font-medium">
        {formatTime(currentSecond)}
      </span>
      <span className="text-[11px] text-ink-20">/</span>
      <span className="text-[11px] text-ink-30 tabular-nums font-medium">
        {formatTime(duration)}
      </span>
    </div>
  );
});
