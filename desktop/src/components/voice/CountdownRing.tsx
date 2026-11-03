import type { ReactNode } from 'react';

const R = 9;
const LEN = 2 * Math.PI * R;

export function CountdownRing({
  ms,
  size,
  paused = false,
  children,
}: {
  ms: number;
  size: number;
  paused?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg aria-hidden viewBox="0 0 22 22" className="absolute inset-0 -rotate-90">
        <circle cx="11" cy="11" r={R} fill="none" className="stroke-ink/[0.12]" strokeWidth="2" />
        <circle
          cx="11"
          cy="11"
          r={R}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={LEN}
          style={{
            ['--len' as string]: `${LEN}`,
            animation: `vx-countdown ${ms}ms linear forwards`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
        />
      </svg>
      <span className="relative flex items-center justify-center">{children}</span>
    </span>
  );
}
