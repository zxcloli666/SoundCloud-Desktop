import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Sparkles, Star } from '../../../../lib/icons';
import { useSubscription } from '../../../../lib/subscription';
import { useAuthStore } from '../../../../stores/auth';
import { Countdown, isExpired } from './countdown';

const UNLOCK_AT = new Date('2026-05-25T12:00:00+03:00').getTime();
const BOOSTY_URL = 'https://boosty.to/lolinamide/purchase/3886747';

const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  i,
  size: 2 + (i % 3),
  left: (i * 41) % 100,
  top: (i * 67) % 100,
  hue: 250 + ((i * 13) % 70),
  delay: (i * 0.27) % 5,
  duration: 4 + (i % 4),
  opacity: 0.35 + (i % 3) * 0.18,
}));

const STAR_GLYPHS = Array.from({ length: 10 }, (_, i) => ({
  i,
  size: 7 + ((i * 5) % 11),
  left: (i * 71) % 100,
  top: (i * 43) % 100,
  rotate: (i * 37) % 360,
  hue: 260 + ((i * 11) % 60),
  delay: (i * 0.4) % 4,
  duration: 5 + (i % 4),
  opacity: 0.25 + (i % 3) * 0.18,
}));

export const SoundWaveLockOverlay = React.memo(function SoundWaveLockOverlay() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: isPremium } = useSubscription(isAuthenticated);

  // Single state flip when timer reaches zero — overlay then unmounts.
  const [expired, setExpired] = useState(() => isExpired(UNLOCK_AT));
  const handleExpire = useCallback(() => setExpired(true), []);

  if (isPremium) return null;
  if (expired) return null;

  return (
    <div
      className="absolute inset-0 z-20 overflow-hidden rounded-[34px]"
      style={{ contain: 'layout paint style' }}
    >
      {/* Vision Pro glass: heavy blur of underlying SoundWave content */}
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: 'blur(36px) saturate(180%)',
          WebkitBackdropFilter: 'blur(36px) saturate(180%)',
          background:
            'radial-gradient(ellipse 80% 70% at 50% 30%, rgba(139,92,246,0.28) 0%, transparent 65%), linear-gradient(165deg, rgba(20,12,38,0.72) 0%, rgba(12,8,22,0.78) 55%, rgba(8,6,16,0.82) 100%)',
          contain: 'strict',
          transform: 'translateZ(0)',
        }}
      />

      {/* Diagonal sheen */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(120deg, transparent 0%, transparent 35%, rgba(192,132,252,0.10) 50%, transparent 65%, transparent 100%)',
          contain: 'strict',
          transform: 'translateZ(0)',
        }}
      />

      {/* Floating star glyphs */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{ contain: 'strict', transform: 'translateZ(0)' }}
      >
        {STAR_GLYPHS.map((s) => (
          <div
            key={`g-${s.i}`}
            className="absolute"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              color: `hsl(${s.hue}, 85%, 78%)`,
              opacity: s.opacity,
              transform: `rotate(${s.rotate}deg)`,
              filter: `drop-shadow(0 0 ${s.size}px hsl(${s.hue}, 90%, 70%))`,
              animation: `star-float ${s.duration}s ease-in-out ${s.delay}s infinite alternate`,
            }}
          >
            <Star size={s.size} fill="currentColor" />
          </div>
        ))}
        {PARTICLES.map((p) => (
          <div
            key={`p-${p.i}`}
            className="absolute rounded-full"
            style={{
              width: `${p.size}px`,
              height: `${p.size}px`,
              left: `${p.left}%`,
              top: `${p.top}%`,
              background: `hsl(${p.hue}, 80%, 75%)`,
              opacity: p.opacity,
              boxShadow: `0 0 ${p.size * 3}px hsl(${p.hue}, 90%, 72%)`,
              animation: `star-float ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* Top edge highlight (frosted glass spec) */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)',
        }}
      />

      {/* Content — static composition; only <Countdown/> mutates per-second */}
      <div
        className="relative z-10 flex h-full w-full flex-col items-center justify-center text-center px-6 py-8"
        style={{ isolation: 'isolate' }}
      >
        {/* Wordmark */}
        <h3
          className="font-black uppercase leading-none mb-3 select-none"
          style={{
            fontSize: 'clamp(36px, 5.5vw, 64px)',
            letterSpacing: '0.08em',
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(232,213,255,0.95) 35%, rgba(192,132,252,0.9) 70%, rgba(139,92,246,0.55) 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter:
              'drop-shadow(0 2px 8px rgba(168,85,247,0.45)) drop-shadow(0 0 28px rgba(139,92,246,0.35))',
          }}
        >
          {t('soundwaveLock.wordmark')}
        </h3>

        {/* Badge */}
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/95 mb-4"
          style={{
            background:
              'linear-gradient(135deg, rgba(168,85,247,0.45), rgba(139,92,246,0.32), rgba(192,132,252,0.25))',
            border: '0.5px solid rgba(168,85,247,0.45)',
            boxShadow:
              'inset 0 0.5px 0 rgba(255,255,255,0.25), 0 0 24px rgba(168,85,247,0.45), 0 4px 14px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <Sparkles size={10} className="text-amber-300" />
          {t('soundwaveLock.badge')}
        </div>

        {/* Title with star */}
        <h2
          className="flex items-center justify-center gap-2.5 text-[26px] sm:text-[30px] font-bold tracking-tight text-white leading-tight"
          style={{
            background:
              'linear-gradient(180deg, #ffffff 0%, rgba(232,213,255,0.95) 50%, rgba(192,132,252,0.85) 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 1px 2px rgba(0,0,0,0.25)',
          }}
        >
          {t('soundwaveLock.title')}
          <span
            className="inline-flex items-center justify-center text-amber-300"
            style={{
              filter:
                'drop-shadow(0 0 10px rgba(252,211,77,0.7)) drop-shadow(0 0 20px rgba(168,85,247,0.55))',
              WebkitTextFillColor: 'currentColor',
            }}
          >
            <Star size={28} fill="currentColor" />
          </span>
        </h2>

        {/* Subtitle */}
        <p className="text-[12.5px] text-purple-100/55 mt-2 font-medium tracking-wide">
          {t('soundwaveLock.subtitle')}
        </p>

        {/* Countdown — isolated re-render boundary; mutates DOM via refs */}
        <Countdown target={UNLOCK_AT} onExpire={handleExpire} />

        {/* CTA */}
        <a
          href={BOOSTY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-2 mt-6 pl-5 pr-4 py-2.5 rounded-full text-[13.5px] font-bold tracking-tight text-white transition-all duration-200 ease-[var(--ease-apple)] hover:scale-[1.04] active:scale-[0.97] cursor-pointer"
          style={{
            background:
              'linear-gradient(135deg, rgb(168,85,247) 0%, rgb(139,92,246) 50%, rgb(192,132,252) 100%)',
            border: '0.5px solid rgba(255,255,255,0.25)',
            boxShadow:
              '0 8px 28px rgba(139,92,246,0.55), 0 0 24px rgba(168,85,247,0.45), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2)',
          }}
        >
          <Star
            size={14}
            fill="currentColor"
            className="text-amber-300"
            style={{ filter: 'drop-shadow(0 0 6px rgba(252,211,77,0.8))' }}
          />
          {t('soundwaveLock.cta')}
          <ExternalLink
            size={12}
            className="text-white/70 transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </a>
      </div>
    </div>
  );
});
