import { memo, type ReactNode } from 'react';
import { Check } from '../../../../lib/icons';
import { usePerfMode } from '../../../../lib/perf';

export const Orb = memo(function Orb({
  tone,
  children,
}: {
  tone: 'wait' | 'bad' | 'ok';
  children: ReactNode;
}) {
  const pulse = usePerfMode().idleAnim && tone === 'wait';
  const bad = tone === 'bad';
  return (
    <span className="relative grid size-[88px] shrink-0 place-items-center">
      <span
        className={`absolute inset-0 rounded-full ${pulse ? 'star-pulse' : ''}`}
        style={{
          background: bad
            ? 'rgb(var(--bad) / 0.12)'
            : 'color-mix(in srgb, var(--color-accent) 14%, transparent)',
        }}
      />
      <span
        className="relative grid size-[56px] place-items-center rounded-full"
        style={{
          background: bad
            ? 'rgb(var(--bad) / 0.16)'
            : 'color-mix(in srgb, var(--color-accent) 20%, transparent)',
          color: bad ? 'rgb(var(--bad))' : 'var(--color-accent)',
        }}
      >
        {children}
      </span>
    </span>
  );
});

export const PaidMark = memo(function PaidMark({ size = 56 }: { size?: number }) {
  return (
    <span
      className="star-pop grid shrink-0 place-items-center rounded-full bg-accent text-accent-contrast"
      style={{ width: size, height: size }}
    >
      <Check size={Math.round(size / 2)} strokeWidth={3} />
    </span>
  );
});
