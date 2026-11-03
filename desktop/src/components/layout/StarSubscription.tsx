import React from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import { useSubscription } from '../../lib/subscription';
import { useAuthStore } from '../../stores/auth';

/* ── Animated star particles (CSS-only, GPU-composited) ─────────── */

const PARTICLES = Array.from({ length: 12 }, (_, i) => i);

const StarParticles = React.memo(() => {
  const perf = usePerfMode();
  const count = perf.particles(PARTICLES.length);
  if (count === 0) return null;
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ contain: 'strict', transform: 'translateZ(0)' }}
    >
      {PARTICLES.slice(0, count).map((i) => (
        <div
          key={i}
          className="absolute w-[3px] h-[3px] rounded-full"
          style={{
            background: `hsl(${260 + ((i * 20) % 60)}, 80%, ${70 + ((i * 5) % 30)}%)`,
            left: `${10 + ((i * 37) % 80)}%`,
            top: `${10 + ((i * 53) % 80)}%`,
            opacity: 0.4 + (i % 3) * 0.2,
            animation: perf.idleAnim
              ? `star-float ${3 + (i % 3)}s ease-in-out ${(i * 0.4) % 3}s infinite alternate`
              : undefined,
          }}
        />
      ))}
    </div>
  );
});

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

/* ── Star Badge (next to username / plan badge) ─────────────────── */

interface StarBadgeProps {
  size?: 'sm' | 'lg';
}

export const StarBadge = React.memo(({ size = 'sm' }: StarBadgeProps) => {
  const isLg = size === 'lg';
  return (
    <span
      className={`inline-flex items-center shrink-0 rounded-full uppercase text-ink-95 ${
        isLg
          ? 'gap-1.5 px-3 py-1 text-[10px] font-extrabold tracking-widest'
          : 'gap-[3px] px-[6px] py-[1px] text-[9px] font-bold tracking-wider'
      }`}
      style={{
        background:
          'linear-gradient(135deg, rgba(139,92,246,0.45), rgba(168,85,247,0.32), rgba(192,132,252,0.25))',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: isLg
          ? 'inset 0 0.5px 0 rgba(255,255,255,0.2), 0 0 20px rgba(139,92,246,0.4)'
          : 'inset 0 0.5px 0 rgba(255,255,255,0.15), 0 0 8px rgba(139,92,246,0.25)',
        border: '0.5px solid rgba(168,85,247,0.35)',
      }}
    >
      <Star
        size={isLg ? 12 : 10}
        fill="currentColor"
        className="text-amber-400"
        style={isLg ? { filter: 'drop-shadow(0 0 4px rgba(168,85,247,0.6))' } : undefined}
      />
      Star
    </span>
  );
});

/* ── Star Card (sidebar, above collapse button) ────────────────── */

interface StarCardProps {
  collapsed: boolean;
  isPremium: boolean;
  onOpen: () => void;
}

export const StarCard = React.memo(({ collapsed, isPremium, onOpen }: StarCardProps) => {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const cardBlur = perf.blur(16);

  if (collapsed) {
    return (
      <button
        type="button"
        data-ui="star-card"
        onClick={onOpen}
        title={t('star.title')}
        className="relative flex items-center justify-center w-full py-2.5 rounded-xl cursor-pointer transition-all duration-200 hover:scale-105 group"
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(168,85,247,0.12))',
          border: '0.5px solid rgba(168,85,247,0.2)',
        }}
      >
        <span
          className="text-amber-400"
          style={{ filter: 'drop-shadow(0 0 4px rgba(168,85,247,0.6))' }}
        >
          <Star size={16} fill="currentColor" />
        </span>
        <StarParticles />
      </button>
    );
  }

  return (
    <button
      type="button"
      data-ui="star-card"
      onClick={onOpen}
      className="relative flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.01] overflow-hidden group"
      style={{
        background:
          'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(168,85,247,0.1), rgba(192,132,252,0.08))',
        backdropFilter: cardBlur > 0 ? `blur(${cardBlur}px)` : undefined,
        WebkitBackdropFilter: cardBlur > 0 ? `blur(${cardBlur}px)` : undefined,
        border: '0.5px solid rgba(168,85,247,0.2)',
        boxShadow: '0 2px 12px rgba(139,92,246,0.12), inset 0 0.5px 0 rgba(255,255,255,0.08)',
      }}
    >
      <StarParticles />
      <div className="relative flex items-center gap-2.5" style={{ isolation: 'isolate' }}>
        <span
          className="text-amber-400 shrink-0"
          style={{ filter: 'drop-shadow(0 0 6px rgba(168,85,247,0.5))' }}
        >
          <Star size={16} fill="currentColor" />
        </span>
        <div className="flex flex-col items-start min-w-0">
          <span className="text-[11px] font-semibold text-ink-90 tracking-wide">
            {t('star.title')}
          </span>
          <span className="text-[9px] text-purple-300/60 font-medium">
            {isPremium ? t('star.active') : t('star.getIt')}
          </span>
        </div>
      </div>
    </button>
  );
});

/* ── Sidebar integration hook ───────────────────────────────────── */

export function useStarSubscription() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: isPremium } = useSubscription(isAuthenticated);
  return { isPremium: !!isPremium };
}
