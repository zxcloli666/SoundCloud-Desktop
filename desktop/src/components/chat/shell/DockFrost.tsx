import { memo } from 'react';
import { surface } from '../../../lib/chat/tone';
import { usePerfMode } from '../../../lib/perf';

export const DockFrost = memo(function DockFrost() {
  const blur = usePerfMode().blur(48);
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 overflow-hidden"
        style={{
          contain: 'strict',
          transform: 'translateZ(0)',
          background: blur > 0 ? surface(6, 72) : surface(7, 97),
          backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.5)` : undefined,
          WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.5)` : undefined,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-px"
        style={{
          background:
            'linear-gradient(to bottom, transparent, var(--color-accent) 42%, transparent)',
          opacity: 0.45,
        }}
      />
    </>
  );
});
