import { memo } from 'react';

export const ProgressRing = memo(function ProgressRing({
  value,
  size,
  stroke = 3,
  waiting = false,
  still = false,
  tone = 'var(--color-accent)',
}: {
  value: number;
  size: number;
  stroke?: number;
  waiting?: boolean;
  still?: boolean;
  tone?: string;
}) {
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const shown = waiting ? 0.22 : Math.max(0.04, Math.min(1, value));
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
      className={waiting && !still ? 'animate-spin motion-reduce:animate-none' : undefined}
      style={{ animationDuration: waiting ? '1.4s' : undefined }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgb(var(--ink) / 0.14)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={tone}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - shown)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 320ms var(--ease-apple, ease-out)' }}
      />
    </svg>
  );
});
