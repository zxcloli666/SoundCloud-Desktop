import { memo } from 'react';
import { usePerfMode } from '../../../lib/perf';

export const ChatsGlow = memo(function ChatsGlow() {
  const perf = usePerfMode();
  if (!perf.atmosphere) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{
        contain: 'strict',
        transform: 'translateZ(0)',
        background:
          'radial-gradient(48% 55% at 12% 18%, var(--color-accent-glow), transparent 70%), radial-gradient(42% 50% at 88% 92%, var(--color-accent-glow), transparent 72%)',
        opacity: perf.mode === 'beauty' ? 0.9 : 0.6,
      }}
    />
  );
});
