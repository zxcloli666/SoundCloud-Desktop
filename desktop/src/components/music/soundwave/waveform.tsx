import React, { useEffect, useMemo, useRef } from 'react';
import { getCurrentTime, getDuration, seek, subscribe } from '../../../lib/audio';
import { type PerfMode, usePerfMode } from '../../../lib/perf';
import { useTrackWaveform } from '../../../lib/waveform';
import type { Track } from '../../../stores/player';

const BAR_COUNT = 160;

/** Rendered bars per mode (drawn twice: muted + accent layer). */
function barsForMode(mode: PerfMode): number {
  if (mode === 'light') return 64;
  if (mode === 'medium') return 120;
  return BAR_COUNT;
}

/** Downsample SC waveform samples into BAR_COUNT averaged bars (0..1). */
function downsample(samples: number[], height: number, count: number): number[] {
  if (!samples.length) return new Array(count).fill(0.35);
  const bucketSize = samples.length / count;
  const out = new Array<number>(count);
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.max(start + 1, Math.floor((i + 1) * bucketSize));
    let sum = 0;
    let n = 0;
    for (let j = start; j < end && j < samples.length; j++) {
      sum += samples[j];
      n++;
    }
    const avg = n > 0 ? sum / n / height : 0.35;
    out[i] = 0.18 + Math.min(0.82, avg * 0.95);
  }
  return out;
}

/** Decorative fallback pattern used during load / when SC has no waveform. */
function fallbackBars(count: number): number[] {
  const arr = new Array<number>(count);
  for (let i = 0; i < count; i++) {
    const x = i / count;
    const base = 0.35 + 0.28 * Math.sin(x * Math.PI * 2);
    const detail = 0.18 * Math.sin(x * Math.PI * 14 + 1.3);
    arr[i] = Math.max(0.22, Math.min(0.95, base + detail));
  }
  return arr;
}

interface Props {
  /** Track whose waveform to render; null → idle/fallback pattern. */
  track: Track | null;
  /** Whether `track` is the one currently loaded in the audio engine. */
  isCurrent: boolean;
  /** Optional fixed progress for non-playing visual previews. */
  progressOverride?: number;
}

/**
 * Progress-bearing waveform. Bars are drawn twice (muted + accent); the accent
 * layer is clipped by `--sw-progress` which we update via DOM refs on each
 * audio tick — no React re-renders while the track plays.
 */
export const LiveWaveform = React.memo(
  function LiveWaveform({ track, isCurrent, progressOverride }: Props) {
    const { data: samples, isLoading } = useTrackWaveform(track);
    const { mode } = usePerfMode();
    const barCount = barsForMode(mode);

    const bars = useMemo(() => {
      if (!samples) return fallbackBars(barCount);
      return downsample(samples.values, samples.height, barCount);
    }, [samples, barCount]);

    const rootRef = useRef<HTMLDivElement>(null);
    const hintRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!isCurrent) {
        if (rootRef.current) rootRef.current.style.setProperty('--sw-progress', '0%');
        if (hintRef.current) hintRef.current.style.left = '0%';
        return;
      }
      const paint = () => {
        if (progressOverride != null) {
          const pct = Math.min(100, Math.max(0, progressOverride));
          if (rootRef.current) rootRef.current.style.setProperty('--sw-progress', `${pct}%`);
          if (hintRef.current) hintRef.current.style.left = `${pct}%`;
          return;
        }
        const t = getCurrentTime();
        const d = getDuration();
        const pct = d > 0 ? Math.min(100, Math.max(0, (t / d) * 100)) : 0;
        if (rootRef.current) rootRef.current.style.setProperty('--sw-progress', `${pct}%`);
        if (hintRef.current) hintRef.current.style.left = `${pct}%`;
      };
      paint();
      return subscribe(paint);
    }, [isCurrent, progressOverride]);

    const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isCurrent) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const d = getDuration();
      if (d > 0) seek(pct * d);
    };

    return (
      <div
        ref={rootRef}
        className={`sw-bars relative w-full h-[96px] ${isCurrent ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={handleBarClick}
      >
        <div className="sw-layer-muted absolute inset-0 flex items-center gap-[2px]">
          {bars.map((v, i) => (
            <div key={i} className="sw-bar flex-1" style={{ height: `${v * 100}%` }} />
          ))}
        </div>
        <div className="sw-layer-accent absolute inset-0 flex items-center gap-[2px]">
          {bars.map((v, i) => (
            <div key={i} className="sw-bar flex-1" style={{ height: `${v * 100}%` }} />
          ))}
        </div>
        {isLoading && (
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.8s ease-in-out infinite',
            }}
          />
        )}
        {isCurrent && (
          <div
            ref={hintRef}
            className="absolute top-0 bottom-0 w-[2px] pointer-events-none rounded-full"
            style={{
              left: '0%',
              background: 'var(--color-accent)',
              boxShadow: '0 0 8px var(--color-accent-glow), 0 0 16px var(--color-accent-glow)',
            }}
          />
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.track?.urn === next.track?.urn &&
    prev.isCurrent === next.isCurrent &&
    prev.progressOverride === next.progressOverride,
);
