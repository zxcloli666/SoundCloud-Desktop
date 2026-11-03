import type React from 'react';
import { memo } from 'react';
import { type Aura, auraRgba } from '../../lib/aura';
import {usePerfMode} from '../../lib/perf';
import { HERO_STAR_SEEDS, StarField } from '../user/StarField';

interface GlassHeroPanelProps {
  hasStar: boolean;
  aura: Aura;
  className?: string;
  children: React.ReactNode;
}

function GlassHeroPanelImpl({ hasStar, aura, className, children }: GlassHeroPanelProps) {
    const perf = usePerfMode();
    const b = perf.blur(40);
    const filter = b > 0 ? `blur(${b}px) saturate(160%)` : undefined;
  return (
    <div
      data-ui="hero"
      className={`relative rounded-[2.5rem] ${className ?? ''}`}
      style={{
        background:
            b > 0
                ? 'linear-gradient(165deg, rgb(var(--ink) / 0.06) 0%, rgb(var(--ink) / 0.02) 50%, rgb(var(--ink) / 0.04) 100%)'
                : 'rgb(var(--surface) / 0.82)',
          backdropFilter: filter,
          WebkitBackdropFilter: filter,
        boxShadow: hasStar
          ? `0 30px 80px rgb(var(--shade) / calc(0.4 * var(--shade-alpha))), 0 0 80px ${auraRgba(aura, 0.18)}, inset 0 0 0 1px ${auraRgba(aura, 0.3)}, inset 0 1px 0 rgb(var(--ink) / 0.1)`
          : '0 30px 80px rgb(var(--shade) / calc(0.35 * var(--shade-alpha))), inset 0 0 0 1px rgb(var(--ink) / 0.08), inset 0 1px 0 rgb(var(--ink) / 0.08)',
        animation: 'hub-rise 700ms cubic-bezier(0.2,0.8,0.2,1) both',
        isolation: 'isolate',
      }}
    >
      {hasStar && (
        <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none">
          <StarField aura={aura} seeds={HERO_STAR_SEEDS} intensity={1} />
        </div>
      )}

      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, rgb(var(--ink) / 0.35), transparent)',
        }}
      />

      {children}
    </div>
  );
}

export const GlassHeroPanel = memo(GlassHeroPanelImpl);
