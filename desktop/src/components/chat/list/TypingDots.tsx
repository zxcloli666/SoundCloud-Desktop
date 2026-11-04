import { memo } from 'react';
import { usePerfMode } from '../../../lib/perf';

const BARS = [0, 140, 280];
const RESTING = [0.55, 1, 0.7];

export const TypingDots = memo(function TypingDots() {
  const animate = usePerfMode().idleAnim;
  return (
    <span aria-hidden className="inline-flex h-3 shrink-0 items-end gap-[2px]">
      {BARS.map((delay, index) => (
        <i
          key={delay}
          className="chat-motion block h-full w-[3px] origin-bottom rounded-full bg-[var(--color-accent)]"
          style={{
            transform: animate ? undefined : `scaleY(${RESTING[index]})`,
            animation: animate ? `chat-eq 900ms ${delay}ms ease-in-out infinite` : undefined,
          }}
        />
      ))}
    </span>
  );
});
