import React, { useEffect, useMemo, useRef } from 'react';
import { getCurrentTime, getDuration, subscribe } from '../../lib/audio';
import { type Track, usePlayerStore } from '../../stores/player';
import { genreColor, genreEnergy } from '../search/utils';

interface Slice {
  urn: string;
  title: string;
  h: number;
  color: string;
}

export const SetRibbon = React.memo(function SetRibbon({
  tracks,
  onJump,
}: {
  tracks: Track[];
  onJump: (index: number) => void;
}) {
  const currentUrn = usePlayerStore((s) => s.currentTrack?.urn);
  const playheadRef = useRef<HTMLDivElement>(null);

  const sig = `${tracks.length}:${tracks[0]?.urn ?? ''}:${tracks[tracks.length - 1]?.urn ?? ''}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on cheap signature
  const slices = useMemo<Slice[]>(
    () =>
      tracks.map((tr) => ({
        urn: tr.urn,
        title: tr.title,
        h: genreEnergy(tr.genre),
        color: genreColor(tr.genre),
      })),
    [sig],
  );

  const n = tracks.length;
  const currentIndex = useMemo(
    () => (currentUrn ? tracks.findIndex((tr) => tr.urn === currentUrn) : -1),
    [currentUrn, tracks],
  );

  useEffect(() => {
    const el = playheadRef.current;
    if (!el) return;
    if (currentIndex < 0 || n === 0) {
      el.style.opacity = '0';
      return;
    }
    el.style.opacity = '1';
    const paint = () => {
      const d = getDuration();
      const frac = d > 0 ? Math.min(1, Math.max(0, getCurrentTime() / d)) : 0;
      el.style.left = `${((currentIndex + frac) / n) * 100}%`;
    };
    paint();
    return subscribe(paint);
  }, [currentIndex, n]);

  if (n === 0) return null;

  return (
    <div className="relative flex items-end gap-[1.5px] h-16 w-full">
      {slices.map((s, i) => (
        <button
          key={s.urn}
          type="button"
          onClick={() => onJump(i)}
          title={s.title}
          className="group/slice relative flex-1 min-w-0 h-full flex items-end cursor-pointer"
        >
          <span
            className={`w-full rounded-t-[2px] transition-all duration-200 group-hover/slice:opacity-100 ${
              i === currentIndex ? 'opacity-100' : 'opacity-50'
            }`}
            style={{
              height: `${Math.max(12, s.h * 100)}%`,
              background: s.color,
            }}
          />
        </button>
      ))}
      <div
        ref={playheadRef}
        className="absolute top-0 bottom-0 w-[2px] rounded-full pointer-events-none z-10"
        style={{
          left: '0%',
          opacity: 0,
          background: 'var(--color-accent)',
        }}
        aria-hidden
      />
    </div>
  );
});
