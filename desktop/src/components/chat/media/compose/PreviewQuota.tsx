import type { CSSProperties } from 'react';

const SIZE = 58;
const STROKE = 6;

export function PreviewQuota() {
  const radius = (SIZE - STROKE) / 2;
  const full = 2 * Math.PI * radius;
  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={radius}
        fill="none"
        stroke="rgb(var(--ink) / 0.1)"
        strokeWidth={STROKE}
      />
      <circle
        data-preview-anim
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={radius}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={full}
        strokeDashoffset={full * 0.72}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        style={
          {
            '--ring-full': `${full}`,
            '--ring-to': `${full * 0.72}`,
            animation: 'chat-preview-ring 1.4s cubic-bezier(0.2, 0.8, 0.2, 1) both',
          } as CSSProperties
        }
      />
      <text
        x="50%"
        y="53%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-current text-[12px] font-bold"
      >
        1 GB
      </text>
    </svg>
  );
}
