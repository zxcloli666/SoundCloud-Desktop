import type { ReactNode } from 'react';
import { memo } from 'react';
import { litStyle } from '../../lib/page-glow';

interface GlassHeroPanelProps {
  className?: string;
  glow?: readonly string[];
  star?: boolean;
  children: ReactNode;
}

function GlassHeroPanelImpl({ className, glow, star, children }: GlassHeroPanelProps) {
  return (
    <div
      data-ui="hero"
      data-star={star ? '' : undefined}
      className={`panel relative rounded-3xl ${glow ? 'lit' : ''} ${className ?? ''}`}
      style={glow ? litStyle(glow) : undefined}
    >
      {children}
    </div>
  );
}

export const GlassHeroPanel = memo(GlassHeroPanelImpl);
