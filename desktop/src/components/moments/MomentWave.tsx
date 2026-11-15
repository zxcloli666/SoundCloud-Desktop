import React, { useEffect, useMemo, useRef } from 'react';
import { dur } from '../../lib/formatters';
import type { MomentWindow } from '../../lib/moment';
import { momentShare, seekMoment, subscribeMomentProgress } from '../../lib/moments/channel';
import { type PerfMode, usePerfMode } from '../../lib/perf';
import { downsample, useTrackWaveform } from '../../lib/waveform';
import type { Track } from '../../stores/player';

export const MomentWave = React.memo(function MomentWave({
  track,
  moment,
}: {
  track: Track;
  moment: MomentWindow;
}) {
  const { data } = useTrackWaveform(track);
  const { mode } = usePerfMode();
  const count = barCount(mode);
  const rootRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const scrubRef = useRef(false);

  const bars = useMemo(() => {
    if (!data || !track.duration) return flatBars(count);
    const n = data.values.length;
    const from = Math.floor((n * moment.startMs) / track.duration);
    const to = Math.ceil((n * (moment.startMs + moment.lengthMs)) / track.duration);
    return downsample(data.values.slice(from, Math.max(from + 1, to)), data.height, count);
  }, [data, track.duration, moment.startMs, moment.lengthMs, count]);

  useEffect(() => {
    const paint = () => {
      if (scrubRef.current) return;
      const share = momentShare(track.urn);
      rootRef.current?.style.setProperty('--sw-progress', `${share * 100}%`);
      if (clockRef.current) clockRef.current.textContent = dur(share * moment.lengthMs);
    };
    paint();
    return subscribeMomentProgress(paint);
  }, [track.urn, moment.lengthMs]);

  const seekAt = (event: React.PointerEvent<HTMLDivElement>, commit = false) => {
    const box = event.currentTarget.getBoundingClientRect();
    const share = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    rootRef.current?.style.setProperty('--sw-progress', `${share * 100}%`);
    scrubRef.current = !commit;
    if (commit) void seekMoment(track.urn, share);
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={rootRef}
        data-ui="moment-wave"
        data-no-drag
        role="slider"
        tabIndex={-1}
        aria-valuemin={0}
        aria-valuemax={Math.round(moment.lengthMs / 1000)}
        aria-valuenow={0}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          seekAt(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) seekAt(event);
        }}
        onPointerUp={(event) => seekAt(event, true)}
        className="sw-bars relative h-[64px] w-full cursor-pointer"
      >
        <div className="sw-layer-muted absolute inset-0 flex items-center gap-[3px]">
          {bars.map((v, i) => (
            <div key={i} className="sw-bar flex-1" style={{ height: `${v * 100}%` }} />
          ))}
        </div>
        <div className="sw-layer-accent absolute inset-0 flex items-center gap-[3px]">
          {bars.map((v, i) => (
            <div key={i} className="sw-bar flex-1" style={{ height: `${v * 100}%` }} />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between font-mono text-[11px] tabular-nums text-ink-40">
        <span>
          <span ref={clockRef} style={{ color: 'var(--color-accent)' }}>
            0:00
          </span>
          <span className="mx-1 text-ink-25">/</span>
          {dur(moment.lengthMs)}
        </span>
        <span>
          {dur(moment.startMs)} – {dur(moment.startMs + moment.lengthMs)}
        </span>
      </div>
    </div>
  );
});

function barCount(mode: PerfMode): number {
  if (mode === 'light') return 40;
  if (mode === 'medium') return 56;
  return 72;
}

function flatBars(count: number): number[] {
  return Array.from({ length: count }, (_, i) => 0.3 + 0.12 * Math.sin(i * 0.7));
}
