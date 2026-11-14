import React from 'react';
import { Star } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import { useSubscription } from '../../lib/subscription';
import { useAuthStore } from '../../stores/auth';

/* ── Star Hero Background (premium aura behind UserPage hero) ───── */

const HERO_STARS = Array.from({ length: 28 }, (_, i) => ({
  i,
  size: 6 + ((i * 7) % 14),
  left: (i * 37) % 100,
  top: (i * 53) % 100,
  rotate: (i * 41) % 360,
  hue: 250 + ((i * 13) % 70),
  delay: (i * 0.27) % 5,
  duration: 4 + (i % 5),
  opacity: 0.25 + (i % 4) * 0.15,
}));

const HERO_DOTS = Array.from({ length: 36 }, (_, i) => ({
  i,
  size: 2 + (i % 3),
  left: (i * 71) % 100,
  top: (i * 29) % 100,
  hue: 260 + ((i * 17) % 60),
  delay: (i * 0.31) % 4,
  duration: 3 + (i % 4),
  opacity: 0.3 + (i % 3) * 0.2,
}));

export const StarHeroBackground = React.memo(() => {
  const perf = usePerfMode();
  const dotCount = perf.particles(HERO_DOTS.length);
  const starCount = perf.particles(HERO_STARS.length);
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ contain: 'strict', transform: 'translateZ(0)' }}
    >
      {/* Purple aura layers */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(168,85,247,0.28), transparent 70%), radial-gradient(ellipse 60% 50% at 20% 100%, rgba(139,92,246,0.18), transparent 70%), radial-gradient(ellipse 50% 50% at 90% 80%, rgba(192,132,252,0.16), transparent 70%)',
        }}
      />
      {/* Diagonal sparkle sheen */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            'linear-gradient(120deg, transparent 0%, transparent 40%, rgba(192,132,252,0.08) 50%, transparent 60%, transparent 100%)',
        }}
      />
      {/* Tiny dots */}
      {HERO_DOTS.slice(0, dotCount).map((d) => (
        <div
          key={`d-${d.i}`}
          className="absolute rounded-full"
          style={{
            width: `${d.size}px`,
            height: `${d.size}px`,
            left: `${d.left}%`,
            top: `${d.top}%`,
            background: `hsl(${d.hue}, 80%, 75%)`,
            opacity: d.opacity,
            boxShadow: perf.glow ? `0 0 ${d.size * 2}px hsl(${d.hue}, 90%, 70%)` : undefined,
            animation: perf.idleAnim
              ? `star-float ${d.duration}s ease-in-out ${d.delay}s infinite alternate`
              : undefined,
          }}
        />
      ))}
      {/* Star icons scattered */}
      {HERO_STARS.slice(0, starCount).map((s) => (
        <div
          key={`s-${s.i}`}
          className="absolute"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            color: `hsl(${s.hue}, 85%, 75%)`,
            opacity: s.opacity,
            transform: `rotate(${s.rotate}deg)`,
            filter: perf.glow ? `drop-shadow(0 0 ${s.size}px hsl(${s.hue}, 90%, 70%))` : undefined,
            animation: perf.idleAnim
              ? `star-float ${s.duration}s ease-in-out ${s.delay}s infinite alternate`
              : undefined,
          }}
        >
          <Star size={s.size} fill="currentColor" />
        </div>
      ))}
    </div>
  );
});

export { StarBadge } from './StarBadge';

/* ── Sidebar integration hook ───────────────────────────────────── */

export function useStarSubscription() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: isPremium } = useSubscription(isAuthenticated);
  return { isPremium: !!isPremium };
}
