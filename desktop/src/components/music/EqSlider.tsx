import React, { useCallback, useRef } from 'react';

export const EqSlider = React.memo(function EqSlider({
  index,
  value,
  min,
  max,
  label,
  hollow = false,
  onChange,
}: {
  index: number;
  value: number;
  min: number;
  max: number;
  label: string;
  hollow?: boolean;
  onChange: (index: number, value: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const valueAt = useCallback(
    (clientY: number) => {
      const track = trackRef.current;
      if (!track) return 0;
      const rect = track.getBoundingClientRect();
      const pct = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      return Math.round((pct * (max - min) + min) * 2) / 2;
    },
    [min, max],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      onChange(index, valueAt(e.clientY));
    },
    [index, onChange, valueAt],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      onChange(index, valueAt(e.clientY));
    },
    [index, onChange, valueAt],
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const pct = (Math.max(min, Math.min(max, value)) - min) / (max - min);
  const zero = -min / (max - min);
  const isPositive = value > 0;
  const isNegative = value < 0;
  const color = isPositive ? '52,211,153' : '96,165,250';

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <span
        className={`text-[10px] tabular-nums font-semibold h-4 ${
          isPositive ? 'text-emerald-400' : isNegative ? 'text-blue-400' : 'text-ink-30'
        }`}
      >
        {value > 0 ? '+' : ''}
        {value.toFixed(1)}
      </span>

      <div
        ref={trackRef}
        className="relative w-7 h-[140px] flex items-center justify-center cursor-pointer touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="absolute w-[3px] h-full rounded-full bg-ink/[0.06]" />
        <div
          className="absolute w-2 h-px bg-ink/10 left-1/2 -translate-x-1/2"
          style={{ bottom: `${zero * 100}%` }}
        />
        <div
          className="absolute w-[3px] rounded-full left-1/2 -translate-x-1/2 transition-colors duration-150"
          style={{
            bottom: `${Math.min(pct, zero) * 100}%`,
            top: `${(1 - Math.max(pct, zero)) * 100}%`,
            background: isPositive
              ? `linear-gradient(to top, rgba(${color},0.6), rgba(${color},0.2))`
              : isNegative
                ? `linear-gradient(to bottom, rgba(${color},0.6), rgba(${color},0.2))`
                : 'transparent',
          }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full transition-shadow duration-150 will-change-transform"
          style={{
            bottom: `calc(${pct * 100}% - 8px)`,
            background: hollow
              ? 'transparent'
              : value === 0
                ? 'rgb(var(--ink) / 0.5)'
                : `rgb(${color})`,
            border: hollow
              ? `2px solid ${value === 0 ? 'rgb(var(--ink) / 0.5)' : `rgb(${color})`}`
              : undefined,
            boxShadow: value !== 0 && !hollow ? `0 0 12px rgba(${color},0.4)` : 'none',
          }}
        />
      </div>

      <span className="text-[9px] text-ink-30 font-medium whitespace-nowrap">{label}</span>
    </div>
  );
});
