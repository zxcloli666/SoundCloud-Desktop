import { memo, useRef } from 'react';
import { useLevelDrive } from '../useLevelDrive';

export const LevelBar = memo(function LevelBar({ input, on }: { input: string; on: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLevelDrive(ref, input);
  return (
    <span ref={ref} className="relative block h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
      <span
        className="absolute inset-y-0 left-0 w-full origin-left rounded-full"
        style={{
          transform: 'scaleX(var(--lvl, 0))',
          transition: 'transform 90ms linear',
          background: on
            ? 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, #fff))'
            : 'rgb(var(--ink) / 0.3)',
          willChange: 'transform',
        }}
      />
    </span>
  );
});
