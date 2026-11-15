import { memo, useState } from 'react';
import { nowSec, useSecondsLeft } from '../../../../lib/tick';

const RING = 2 * Math.PI * 15;

export function mmss(secs: number): string {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

export const TimeRing = memo(function TimeRing({ until }: { until: number }) {
  const [start] = useState(nowSec);
  const left = useSecondsLeft(until);
  const total = Math.max(1, until - start);
  return (
    <span
      data-ui="star-timer"
      className="inline-flex items-center gap-2 text-[13px] font-semibold tabular-nums text-ink-80"
    >
      <svg width="20" height="20" viewBox="0 0 36 36" className="-rotate-90" aria-hidden>
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke="rgb(var(--ink) / 0.12)"
          strokeWidth="4"
        />
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={RING}
          strokeDashoffset={RING * (1 - Math.min(1, left / total))}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      {mmss(left)}
    </span>
  );
});
