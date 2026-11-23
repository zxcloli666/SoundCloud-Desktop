import type { ReactNode } from 'react';
import { memo } from 'react';

function GlassHeroPanelImpl({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div data-ui="hero" className={`panel relative rounded-3xl ${className ?? ''}`}>
      {children}
    </div>
  );
}

export const GlassHeroPanel = memo(GlassHeroPanelImpl);
