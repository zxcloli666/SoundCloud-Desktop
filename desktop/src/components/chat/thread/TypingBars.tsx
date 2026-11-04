import { memo } from 'react';
import { usePerfMode } from '../../../lib/perf';

const DELAYS = [0, 140, 280];
const RESTING = [0.55, 1, 0.7];

export const TypingBars = memo(function TypingBars() {
  const animate = usePerfMode().idleAnim;
  return (
    <span aria-hidden className="inline-flex h-[10px] shrink-0 items-end gap-[2px]">
      {DELAYS.map((delay, index) => (
        <i
          key={delay}
          className="chat-thread-motion block h-full w-[2.5px] origin-bottom rounded-full bg-current"
          style={{
            transform: animate ? undefined : `scaleY(${RESTING[index]})`,
            animation: animate ? `chat-thread-eq 900ms ${delay}ms ease-in-out infinite` : undefined,
          }}
        />
      ))}
    </span>
  );
});
