import React from 'react';

export const ProgressRing = React.memo(function ProgressRing({
  value,
  size,
}: {
  value: number;
  size: number;
}) {
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value));

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90"
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - Math.max(clamped, 0.04))}
        style={{
          transition: 'stroke-dashoffset 400ms var(--ease-apple)',
          filter: 'drop-shadow(0 0 4px var(--color-accent-glow))',
        }}
      />
    </svg>
  );
});
