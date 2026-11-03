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
  border: string;
  glow: string;
  starColor: string;
  pips: number;
  sheen: boolean;
  aurora: boolean;
  sparkles: boolean;
}

const LOOKS: Record<StarTier, TierLook> = {
  0: {
    background:
      'linear-gradient(135deg, rgba(139,92,246,0.45), rgba(168,85,247,0.32), rgba(192,132,252,0.25))',
    border: '0.5px solid rgba(168,85,247,0.35)',
    glow: '139,92,246',
    starColor: '#fbbf24',
    pips: 0,
    sheen: false,
    aurora: false,
    sparkles: false,
  },
  1: {
    background:
      'linear-gradient(135deg, rgba(124,58,237,0.7), rgba(192,38,211,0.5), rgba(192,132,252,0.4))',
    border: '0.5px solid rgba(232,121,249,0.6)',
    glow: '217,70,239',
    starColor: '#fcd34d',
    pips: 1,
    sheen: false,
    aurora: false,
    sparkles: false,
  },
  2: {
    background:
      'linear-gradient(135deg, rgba(109,40,217,0.8), rgba(219,39,119,0.6), rgba(245,158,11,0.5))',
    border: '0.75px solid rgba(252,211,77,0.7)',
    glow: '245,158,11',
    starColor: '#fde68a',
    pips: 2,
    sheen: true,
    aurora: false,
    sparkles: false,
  },
  3: {
    background:
      'linear-gradient(110deg, #6d28d9, #db2777, #f59e0b, #fde047, #db2777, #6d28d9)',
    border: '1px solid rgba(254,240,138,0.9)',
    glow: '250,204,21',
    starColor: '#fffbeb',
    pips: 3,
    sheen: true,
    aurora: true,
    sparkles: true,
  },
};

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
    'inline-flex items-center shrink-0 rounded-full uppercase',
    tier === 3 ? 'text-white' : 'text-ink-95',
    isLg
      ? 'gap-1.5 px-3 py-1 text-[10px] font-extrabold tracking-widest'
      : 'gap-[3px] px-[6px] py-[1px] text-[9px] font-bold tracking-wider',
    moving && look.sheen ? 'star-badge-sheen' : '',
    moving && look.aurora ? 'star-badge-aurora' : '',
  ].join(' ');

  return (
    <span className="relative inline-flex shrink-0" data-tier={tier}>
      <span
        className={pillClass}
        style={{
          background: look.background,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: `inset 0 0.5px 0 rgba(255,255,255,0.2)${
            perf.glow || tier > 0 ? `, 0 0 ${glowPx}px rgba(${look.glow},${0.3 + tier * 0.12})` : ''
          }`,
          border: look.border,
          textShadow: tier === 3 ? '0 1px 2px rgba(88,28,135,0.6)' : undefined,
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
