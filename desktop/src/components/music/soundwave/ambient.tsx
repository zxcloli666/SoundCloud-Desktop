import React, { useMemo } from 'react';
import {usePerfMode} from '../../../lib/perf';

interface Props {
  /** Number of drifting accent particles. Fewer on smaller blocks. */
  particleCount?: number;
  /** Max blur radius for aurora orbs. Lower = cheaper GPU paint. */
  blur?: number;
  /** Primary aurora opacity. */
  intensity?: number;
}

/**
 * Decorative aurora + particle layer for SoundWave blocks.
 * Pure CSS animations, `contain: strict` isolates repaints, no React updates
 * during animation.
 */
export const AmbientLayer = React.memo(function AmbientLayer({
  particleCount = 12,
  blur = 45,
  intensity = 0.55,
}: Props) {
    const perf = usePerfMode();
    const count = perf.particles(particleCount);
    const orbBlur = perf.blur(blur);
    const particles = useMemo(() => Array.from({length: count}, (_, i) => i), [count]);

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      aria-hidden
      style={{ contain: 'strict', transform: 'translateZ(0)' }}
    >
      <div
        className="absolute -top-1/3 -left-1/4 w-[55%] h-[170%] rounded-full"
        style={{
          background: 'radial-gradient(closest-side, var(--color-accent-glow), transparent 70%)',
            filter: `blur(${orbBlur}px)`,
          opacity: intensity,
            animation: perf.idleAnim ? 'sw-aurora 32s linear infinite' : undefined,
        }}
      />
      <div
        className="absolute -bottom-1/2 right-[-12%] w-[50%] h-[160%] rounded-full"
        style={{
          background: 'radial-gradient(closest-side, rgb(var(--ink) / 0.07), transparent 70%)',
            filter: `blur(${orbBlur + 5}px)`,
          opacity: intensity * 0.9,
            animation: perf.idleAnim ? 'sw-aurora 44s linear reverse infinite' : undefined,
        }}
      />
      {particles.map((i) => {
        const size = 2 + (i % 3);
        const left = (i * 41) % 100;
        const top = 12 + ((i * 53) % 70);
        const duration = 5200 + ((i * 313) % 3200);
        const delay = (i * 277) % 3800;
        return (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              left: `${left}%`,
              top: `${top}%`,
              background: 'var(--color-accent)',
                boxShadow: perf.glow ? '0 0 6px var(--color-accent-glow)' : undefined,
                animation: perf.idleAnim
                    ? `sw-drift ${duration}ms ease-in-out ${delay}ms infinite`
                    : undefined,
            }}
          />
        );
      })}
    </div>
  );
});
