import React, { type ReactNode } from 'react';
import { usePerfMode } from '../../lib/perf';

interface Props {
  icon: ReactNode;
  title: string;
  hint?: string;
  chip: string;
}

export const DropOverlay = React.memo(function DropOverlay({ icon, title, hint, chip }: Props) {
  const perf = usePerfMode();
  const blur = perf.blur(18);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center p-5 animate-fade-in-up motion-reduce:animate-none"
      style={{
        background: blur > 0 ? 'rgb(var(--paper) / 0.55)' : 'rgb(var(--paper) / 0.85)',
        backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.3)` : undefined,
        WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.3)` : undefined,
      }}
    >
      <div
        className="absolute inset-5 rounded-[28px] border-2 border-dashed"
        style={{
          borderColor: 'var(--color-accent)',
          background:
            'radial-gradient(60% 60% at 50% 45%, var(--color-accent-glow), transparent 70%)',
        }}
      />
      <div className="relative flex flex-col items-center text-center">
        <span
          className="relative flex size-24 items-center justify-center rounded-[30px]"
          style={{
            background: 'var(--color-accent-glow)',
            color: 'var(--color-accent-hover)',
            boxShadow: perf.glow ? '0 20px 60px -12px var(--color-accent-glow)' : undefined,
          }}
        >
          {perf.idleAnim && (
            <span
              className="absolute inset-0 animate-ping rounded-[30px] opacity-30"
              style={{ background: 'var(--color-accent-glow)' }}
            />
          )}
          {icon}
        </span>
        <div className="mt-6 max-w-[560px] text-balance text-[22px] font-semibold tracking-[-0.02em] text-ink-95">
          {title}
        </div>
        {hint && (
          <div className="mt-1.5 max-w-[360px] text-[13px] leading-snug text-ink-55">{hint}</div>
        )}
        <div
          className="mt-4 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold tabular-nums"
          style={{ borderColor: 'var(--color-accent-glow)', color: 'var(--color-accent-hover)' }}
        >
          {chip}
        </div>
      </div>
    </div>
  );
});
