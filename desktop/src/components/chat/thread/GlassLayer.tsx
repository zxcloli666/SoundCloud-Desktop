import { memo } from 'react';
import { usePerfMode } from '../../../lib/perf';

export const GlassLayer = memo(function GlassLayer({
  blur,
  tint,
  solid,
  className = '',
}: {
  blur: number;
  tint: string;
  solid: string;
  className?: string;
}) {
  const radius = usePerfMode().blur(blur);
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        contain: radius > 0 ? 'strict' : undefined,
        transform: radius > 0 ? 'translateZ(0)' : undefined,
        background: radius > 0 ? tint : solid,
        backdropFilter: radius > 0 ? `blur(${radius}px) saturate(1.5)` : undefined,
        WebkitBackdropFilter: radius > 0 ? `blur(${radius}px) saturate(1.5)` : undefined,
      }}
    />
  );
});
