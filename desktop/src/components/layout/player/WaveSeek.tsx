import React, { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentTime, getDuration, seek, subscribe } from '../../../lib/audio';
import { tintFromRgb, useCoverPalette } from '../../../lib/cover-palette';
import { formatTime } from '../../../lib/formatters';
import { usePerfMode } from '../../../lib/perf';
import { useWheelSeek } from '../../../lib/useWheelSeek';
import { useTrackWaveform } from '../../../lib/waveform';
import { usePlayerStore } from '../../../stores/player';
import { AbLoopOverlay, tipClass } from './AbLoopOverlay';
import { fallbackBars, peakBars, WAVE_BAR_COUNT } from './wave-bars';

const KEY_STEP_SEC = 5;

function Bars({ bars }: { bars: number[] }) {
  return (
    <>
      {bars.map((height, index) => (
        <i
          key={index}
          className="block flex-1 rounded-full bg-current"
          style={{ height: `${height}%` }}
        />
      ))}
    </>
  );
}

const layerClass = 'pointer-events-none absolute inset-0 flex items-center gap-[2px]';

export const WaveSeek = React.memo(({ className = '' }: { className?: string }) => {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const track = usePlayerStore((s) => s.currentTrack);
  const duration = useSyncExternalStore(subscribe, getDuration);
  const { data: waveform } = useTrackWaveform(track);
  const palette = useCoverPalette(Boolean(track));
  const bars = useMemo(
    () =>
      waveform
        ? peakBars(waveform.values, waveform.height, WAVE_BAR_COUNT)
        : fallbackBars(WAVE_BAR_COUNT),
    [waveform],
  );
  const playedColor = palette ? `rgb(${tintFromRgb(palette.primary).join(' ')})` : undefined;

  const rootRef = useRef<HTMLDivElement>(null);
  const playedRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLSpanElement>(null);
  const hoverRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const draggingRef = useRef(false);
  const dragTimeRef = useRef(0);

  const paint = useCallback((seconds: number) => {
    const total = getDuration();
    const pct = total > 0 ? Math.max(0, Math.min(100, (seconds / total) * 100)) : 0;
    if (playedRef.current) playedRef.current.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    if (headRef.current) headRef.current.style.left = `${pct}%`;
  }, []);

  const timeAt = (clientX: number) => {
    const rect = rootRef.current?.getBoundingClientRect();
    const total = getDuration();
    if (!rect || rect.width <= 0 || total <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * total * 10) / 10;
  };

  const showTip = (clientX: number, seconds: number) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    if (hoverRef.current) {
      hoverRef.current.style.left = `${x}px`;
      hoverRef.current.style.opacity = '1';
    }
    if (tipRef.current) {
      tipRef.current.textContent = formatTime(seconds);
      tipRef.current.style.left = `${x}px`;
      tipRef.current.style.opacity = '1';
    }
  };

  const hideTip = () => {
    if (hoverRef.current) hoverRef.current.style.opacity = '0';
    if (tipRef.current) tipRef.current.style.opacity = '0';
  };

  const wheelTargetRef = useWheelSeek(rootRef, tipRef, {
    position: getCurrentTime,
    duration: getDuration,
    seek,
    preview: paint,
    dragging: () => draggingRef.current,
  });

  useEffect(() => {
    paint(getCurrentTime());
    return subscribe(() => {
      if (draggingRef.current || wheelTargetRef.current !== null) return;
      paint(getCurrentTime());
    });
  }, [wheelTargetRef, paint]);

  const canSeek = duration > 0;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canSeek || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    dragTimeRef.current = timeAt(e.clientX);
    paint(dragTimeRef.current);
    showTip(e.clientX, dragTimeRef.current);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canSeek) return;
    const seconds = timeAt(e.clientX);
    showTip(e.clientX, seconds);
    if (!draggingRef.current) return;
    dragTimeRef.current = seconds;
    paint(seconds);
  };

  const finish = (commit: boolean) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (commit) seek(dragTimeRef.current);
    else paint(getCurrentTime());
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!canSeek) return;
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    seek(Math.max(0, Math.min(getDuration(), getCurrentTime() + dir * KEY_STEP_SEC)));
  };

  return (
    <div
      ref={rootRef}
      role="slider"
      tabIndex={canSeek ? 0 : -1}
      data-ui="player-seek"
      aria-label={t('player.seek')}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(getCurrentTime())}
      aria-disabled={!canSeek}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => finish(true)}
      onPointerCancel={() => finish(false)}
      onPointerLeave={() => {
        if (!draggingRef.current) hideTip();
      }}
      onLostPointerCapture={() => {
        finish(false);
        hideTip();
      }}
      onKeyDown={onKeyDown}
      className={`group relative h-7 w-full touch-none select-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
        canSeek ? 'cursor-pointer' : 'cursor-default opacity-60'
      } ${className}`}
    >
      <div className={`${layerClass} text-ink/[0.2]`}>
        <Bars bars={bars} />
      </div>
      <div
        ref={playedRef}
        className={`${layerClass} text-accent`}
        style={{ color: playedColor, clipPath: 'inset(0 100% 0 0)' }}
      >
        <Bars bars={bars} />
      </div>
      <span
        ref={headRef}
        className="pointer-events-none absolute inset-y-0 w-[2px] -translate-x-1/2 rounded-full bg-ink/60"
        style={{ left: '0%' }}
      />
      <span
        ref={hoverRef}
        className={`pointer-events-none absolute inset-y-1 w-px -translate-x-1/2 bg-ink/30 opacity-0 ${
          perf.idleAnim ? 'transition-opacity duration-100 motion-reduce:transition-none' : ''
        }`}
      />
      <AbLoopOverlay duration={duration} />
      <span ref={tipRef} className={tipClass} />
    </div>
  );
});
