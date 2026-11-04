import type React from 'react';
import { memo, useEffect, useMemo, useRef } from 'react';
import { getCurrentTime, getDuration, playAt, seek, subscribe } from '../../../lib/audio';
import { type PerfMode, usePerfMode } from '../../../lib/perf';
import { useTrackWaveform } from '../../../lib/waveform';
import type { Track } from '../../../stores/player';

const HEIGHT = 22;
const BAR = 2;
const GAP = 1.2;

function barCount(mode: PerfMode): number {
  if (mode === 'light') return 32;
  return mode === 'medium' ? 44 : 56;
}

function seeded(urn: string, count: number): number[] {
  let hash = 2166136261;
  for (let i = 0; i < urn.length; i++) hash = Math.imul(hash ^ urn.charCodeAt(i), 16777619);
  return Array.from({ length: count }, (_, i) => {
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
    const noise = ((hash >>> 0) % 1000) / 1000;
    const swell = 0.45 + 0.3 * Math.sin((i / count) * Math.PI * 2.4 + 0.6);
    return Math.min(1, Math.max(0.16, swell * 0.7 + noise * 0.35));
  });
}

function sampled(values: number[], height: number, count: number): number[] {
  const bucket = values.length / count;
  return Array.from({ length: count }, (_, i) => {
    const from = Math.floor(i * bucket);
    const to = Math.max(from + 1, Math.floor((i + 1) * bucket));
    let sum = 0;
    for (let j = from; j < to; j++) sum += values[j] ?? 0;
    return Math.min(1, Math.max(0.12, sum / (to - from) / height));
  });
}

function Bars({ bars, className }: { bars: number[]; className: string }) {
  const width = bars.length * (BAR + GAP);
  return (
    <svg
      viewBox={`0 0 ${width} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={`absolute inset-0 h-full w-full ${className}`}
      aria-hidden
    >
      {bars.map((value, i) => {
        const h = Math.max(2, value * HEIGHT);
        return (
          <rect key={i} x={i * (BAR + GAP)} y={(HEIGHT - h) / 2} width={BAR} height={h} rx={1} />
        );
      })}
    </svg>
  );
}

interface EmbedWaveProps {
  track: Track;
  live: Track | null;
  current: boolean;
  disabled?: boolean;
  label: string;
}

export const EmbedWave = memo(function EmbedWave({
  track,
  live,
  current,
  disabled = false,
  label,
}: EmbedWaveProps) {
  const { mode } = usePerfMode();
  const count = barCount(mode);
  const { data: samples } = useTrackWaveform(live);
  const bars = useMemo(
    () => (samples ? sampled(samples.values, samples.height, count) : seeded(track.urn, count)),
    [samples, count, track.urn],
  );
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = progressRef.current;
    if (!element) return;
    if (!current) {
      element.style.clipPath = 'inset(0 100% 0 0)';
      return;
    }
    const paint = () => {
      const total = getDuration();
      const share = total > 0 ? Math.min(1, Math.max(0, getCurrentTime() / total)) : 0;
      element.style.clipPath = `inset(0 ${((1 - share) * 100).toFixed(2)}% 0 0)`;
    };
    paint();
    return subscribe(paint);
  }, [current]);

  const onSeek = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const share = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    if (current) {
      const total = getDuration();
      if (total > 0) seek(share * total);
      return;
    }
    const seconds = (track.duration / 1000) * share;
    playAt(live ?? track, seconds);
  };

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onSeek}
      className="relative block h-[22px] w-full cursor-pointer disabled:cursor-default"
    >
      <Bars bars={bars} className={samples ? 'fill-white/[0.22]' : 'fill-white/[0.12]'} />
      <div ref={progressRef} className="absolute inset-0" style={{ clipPath: 'inset(0 100% 0 0)' }}>
        <Bars bars={bars} className="fill-accent" />
      </div>
    </button>
  );
});
