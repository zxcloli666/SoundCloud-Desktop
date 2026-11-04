import { memo, type ReactNode } from 'react';

export type RingTone = 'wait' | 'open' | 'closed';

const DAYS = [0, 1, 2] as const;

const TONE: Record<RingTone, string> = {
  wait: 'text-[var(--color-accent)]',
  open: 'text-emerald-400',
  closed: 'text-rose-400',
};

interface HistoryRingProps {
  size: number;
  progress: number;
  tone: RingTone;
  stroke?: number;
  title?: string;
  children?: ReactNode;
}

export const HistoryRing = memo(function HistoryRing({
  size,
  progress,
  tone,
  stroke = 2,
  title,
  children,
}: HistoryRingProps) {
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const day = length / 3;
  const gap = Math.min(day * 0.18, stroke * 2.2);
  const span = day - gap;
  const filled = tone === 'wait' ? Math.min(1, Math.max(0, progress)) * 3 : 3;
  const center = size / 2;

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      title={title}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={`absolute inset-0 -rotate-90 ${TONE[tone]}`}
        aria-hidden
      >
        {DAYS.map((index) => {
          const share = Math.min(1, Math.max(0, filled - index));
          const offset = -(index * day + gap / 2);
          return (
            <g key={index}>
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                className="stroke-white/10"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${span} ${length}`}
                strokeDashoffset={offset}
              />
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${span * share} ${length}`}
                strokeDashoffset={offset}
                opacity={share > 0 ? 1 : 0}
                style={{
                  transition: `stroke-dasharray 700ms var(--ease-apple) ${index * 120}ms, opacity 200ms`,
                }}
              />
            </g>
          );
        })}
      </svg>
      {children}
    </span>
  );
});
