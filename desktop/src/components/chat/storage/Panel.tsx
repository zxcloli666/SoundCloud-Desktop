import { memo, type ReactNode } from 'react';
import { usePerfMode } from '../../../lib/perf';

export const Panel = memo(function Panel({
  children,
  className = '',
  ui,
  tone = 'plain',
}: {
  children: ReactNode;
  className?: string;
  ui?: string;
  tone?: 'plain' | 'danger';
}) {
  const blur = usePerfMode().blur(32);
  const edge = tone === 'danger' ? 'rgb(var(--bad) / 0.22)' : 'rgb(var(--ink) / 0.09)';
  return (
    <section
      data-ui={ui}
      className={`relative overflow-hidden rounded-[1.5rem] ${className}`}
      style={{
        border: `0.5px solid ${edge}`,
        background:
          blur > 0
            ? `linear-gradient(165deg, rgb(var(--ink) / 0.055), rgb(var(--ink) / 0.015) 60%)${
                tone === 'danger'
                  ? ', linear-gradient(0deg, rgb(var(--bad) / 0.04), transparent)'
                  : ''
              }`
            : 'rgb(var(--surface) / 0.9)',
        backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.4)` : undefined,
        WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.4)` : undefined,
        boxShadow:
          '0 18px 50px -20px rgb(var(--shade) / calc(0.45 * var(--shade-alpha))), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <div className="relative" style={{ isolation: 'isolate' }}>
        {children}
      </div>
    </section>
  );
});

export function PanelTitle({
  icon,
  title,
  aside,
}: {
  icon: ReactNode;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2 text-ink-60">
        <span className="shrink-0">{icon}</span>
        <h2 className="truncate text-[12px] font-semibold uppercase tracking-[0.08em]">{title}</h2>
      </div>
      {aside}
    </div>
  );
}
