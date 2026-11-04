import { memo } from 'react';
import { useCalmMotion } from './motion';

const RADIUS = 15;
const LENGTH = 2 * Math.PI * RADIUS;

export const ProgressRing = memo(function ProgressRing({
  fraction,
  waiting,
  size = 40,
  plain = false,
}: {
  fraction: number;
  waiting: boolean;
  size?: number;
  plain?: boolean;
}) {
  const calm = useCalmMotion();
  const spin = waiting && !calm;
  const shown = waiting ? 0.22 : Math.max(0.04, fraction);
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden
      className="chat-media-motion"
      style={{ animation: spin ? 'chat-media-spin 1.1s linear infinite' : undefined }}
    >
      {!plain && <circle cx="20" cy="20" r="18" fill="rgb(var(--paper) / 0.62)" />}
      <circle
        cx="20"
        cy="20"
        r={RADIUS}
        fill="none"
        stroke="rgb(var(--ink) / 0.16)"
        strokeWidth={plain ? 4 : 2.5}
      />
      <circle
        cx="20"
        cy="20"
        r={RADIUS}
        fill="none"
        stroke="rgb(var(--ink) / 0.92)"
        strokeWidth={plain ? 4 : 2.5}
        strokeLinecap="round"
        strokeDasharray={LENGTH}
        strokeDashoffset={LENGTH * (1 - shown)}
        transform="rotate(-90 20 20)"
        className="chat-media-motion"
        style={{ transition: calm ? undefined : 'stroke-dashoffset 320ms ease-out' }}
      />
    </svg>
  );
});
