import type { ReactNode } from 'react';
import React from 'react';

export const RiverSection = React.memo(function RiverSection({
  title,
  why,
  tone = 'open',
  children,
}: {
  title: string;
  why: string;
  tone?: 'open' | 'panel' | 'deep';
  children: ReactNode;
}) {
  const head = (
    <div className="mb-4">
      <h2 className="text-[21px] font-bold leading-tight tracking-[-0.015em] text-ink-92">
        {title}
      </h2>
      <p className="mt-1 text-[13px] leading-snug text-ink-50">{why}</p>
    </div>
  );

  if (tone === 'open') {
    return (
      <section data-ui="river-section" className="min-w-0">
        {head}
        {children}
      </section>
    );
  }

  return (
    <section data-ui="river-section" className="min-w-0">
      {head}
      <div
        className={`panel rounded-2xl p-4 ${
          tone === 'deep' ? 'border-ink/[0.05] bg-[rgb(var(--paper)/0.55)]' : ''
        }`}
      >
        {children}
      </div>
    </section>
  );
});
