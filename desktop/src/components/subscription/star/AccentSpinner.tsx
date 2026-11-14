import { memo } from 'react';
import { usePerfMode } from '../../../lib/perf';

export const AccentSpinner = memo(function AccentSpinner() {
  const spin = usePerfMode().idleAnim;
  return (
    <span
      className={`size-[18px] rounded-full border-2${spin ? ' animate-spin' : ''}`}
      style={{
        borderColor: 'color-mix(in srgb, var(--color-accent) 30%, transparent)',
        borderTopColor: 'var(--color-accent)',
      }}
    />
  );
});
