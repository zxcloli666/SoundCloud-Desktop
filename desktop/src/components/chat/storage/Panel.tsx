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
  const wash =
    tone === 'danger' ? 'linear-gradient(0deg, rgb(var(--bad) / 0.05), transparent 70%), ' : '';
  return (
    <section
      data-ui={ui}
      className={`relative overflow-hidden rounded-[1.5rem] ${className}`}
      style={{
        border: `0.5px solid ${tone === 'danger' ? 'rgb(var(--bad) / 0.22)' : 'rgb(var(--ink) / 0.09)'}`,
        boxShadow:
          '0 18px 50px -20px rgb(var(--shade) / calc(0.45 * var(--shade-alpha))), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          contain: 'strict',
          transform: 'translateZ(0)',
          background:
            blur > 0
              ? `${wash}linear-gradient(165deg, rgb(var(--ink) / 0.055), rgb(var(--ink) / 0.015) 60%)`
              : `${wash}rgb(var(--surface) / 0.9)`,
          backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.4)` : undefined,
          WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.4)` : undefined,
        }}
      />
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
