import type { ReactNode } from 'react';
import { memo } from 'react';

function GlassHeroPanelImpl({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      data-ui="hero"
      className={`relative rounded-3xl border border-ink/[0.08] bg-ink/[0.025] ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

export const GlassHeroPanel = memo(GlassHeroPanelImpl);
