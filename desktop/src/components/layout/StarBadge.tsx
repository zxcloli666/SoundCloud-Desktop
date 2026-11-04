import React from 'react';
import { Star } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import type { StarTier } from '../../lib/star-tenure';

interface StarBadgeProps {
  size?: 'sm' | 'lg';
  tier?: StarTier;
}

interface TierLook {
  background: string;
  ring: string;
  glow: string;
  starColor: string;
  pips: number;
  sheen: boolean;
  sparkles: boolean;
}

const NIGHT_STARS =
  'radial-gradient(1px 1px at 18% 30%, #fff 60%, transparent 61%), radial-gradient(1px 1px at 46% 72%, #e0f2fe 60%, transparent 61%), radial-gradient(1.5px 1.5px at 74% 26%, #fff 60%, transparent 61%), radial-gradient(1px 1px at 90% 70%, #bae6fd 60%, transparent 61%)';

const LOOKS: Record<StarTier, TierLook> = {
  0: {
    background: 'linear-gradient(135deg, #5b21b6, #7c3aed 55%, #a855f7)',
    ring: '196,181,253',
    glow: '139,92,246',
    starColor: '#fbbf24',
    pips: 0,
    sheen: false,
    sparkles: false,
  },
  1: {
    background: 'linear-gradient(135deg, #9d174d, #db2777 50%, #f472b6)',
    ring: '251,207,232',
    glow: '236,72,153',
    starColor: '#fde68a',
    pips: 1,
    sheen: true,
    sparkles: false,
  },
  2: {
    background: 'linear-gradient(120deg, #991b1b, #ea580c 45%, #f59e0b 80%, #fcd34d)',
    ring: '254,215,170',
    glow: '249,115,22',
    starColor: '#fffbeb',
    pips: 2,
    sheen: true,
    sparkles: false,
  },
  3: {
    background: `${NIGHT_STARS}, linear-gradient(110deg, #0f172a, #312e81 40%, #1d4ed8 75%, #0891b2)`,
    ring: '165,243,252',
    glow: '56,189,248',
    starColor: '#fde047',
    pips: 3,
    sheen: true,
    sparkles: true,
  },
};

export const TIER_FILLS = ([0, 1, 2, 3] as const).map((tier) => LOOKS[tier].background);

const SPARKLES = [
  { left: '-3px', top: '-3px', delay: '0s' },
  { left: '82%', top: '-4px', delay: '0.7s' },
  { left: '38%', top: '88%', delay: '1.3s' },
];

export const StarBadge = React.memo(({ size = 'sm', tier = 0 }: StarBadgeProps) => {
  const isLg = size === 'lg';
  const perf = usePerfMode();
  const look = LOOKS[tier];
  const glowPx = isLg ? 20 + tier * 8 : 8 + tier * 4;
  const moving = perf.idleAnim;
  const pillClass = [
    'inline-flex items-center shrink-0 rounded-full uppercase text-white',
    isLg
      ? 'gap-1.5 px-3 py-1 text-[10px] font-extrabold tracking-widest'
      : 'gap-[3px] px-[6px] py-[1px] text-[9px] font-bold tracking-wider',
    moving && look.sheen ? 'star-badge-sheen' : '',
  ].join(' ');

  return (
    <span className="relative inline-flex shrink-0" data-tier={tier}>
      <span
        className={pillClass}
        style={{
          background: look.background,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.28), 0 0 0 1px rgba(${look.ring},0.55), 0 1px 4px rgba(0,0,0,0.35)${
            perf.glow || tier > 0 ? `, 0 0 ${glowPx}px rgba(${look.glow},${0.3 + tier * 0.12})` : ''
          }`,
          textShadow: '0 1px 2px rgba(0,0,0,0.45)',
        }}
      >
        <Star
          size={isLg ? 12 : 10}
          fill="currentColor"
          style={{
            color: look.starColor,
            filter: `drop-shadow(0 0 ${3 + tier * 2}px rgba(${look.glow},0.8))`,
          }}
        />
        Star
        {look.pips > 0 && <Pips count={look.pips} large={isLg} color={look.starColor} />}
      </span>
      {moving && look.sparkles && perf.glow && <Sparkles large={isLg} />}
    </span>
  );
});

const Pips = React.memo(function Pips({
  count,
  large,
  color,
}: {
  count: number;
  large: boolean;
  color: string;
}) {
  const edge = large ? 4 : 3;
  return (
    <span aria-hidden className="inline-flex items-center gap-[2px]">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          style={{
            width: edge,
            height: edge,
            background: color,
            transform: 'rotate(45deg)',
            boxShadow: `0 0 ${edge + 1}px ${color}`,
          }}
        />
      ))}
    </span>
  );
});

const Sparkles = React.memo(function Sparkles({ large }: { large: boolean }) {
  const edge = large ? 7 : 5;
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {SPARKLES.map((s) => (
        <span
          key={s.left}
          className="star-badge-twinkle absolute"
          style={{
            left: s.left,
            top: s.top,
            width: edge,
            height: edge,
            background: '#fffbeb',
            clipPath: 'polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)',
            animationDelay: s.delay,
            filter: 'drop-shadow(0 0 3px rgba(250,204,21,0.9))',
          }}
        />
      ))}
    </span>
  );
});
