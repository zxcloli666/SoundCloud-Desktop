import React from 'react';
import { fc } from '../../lib/formatters';
import {usePerfMode} from '../../lib/perf';

interface StatOrbProps {
  value: number | null | undefined;
  label: string;
  accent: string;
}

function StatOrbImpl({ value, label, accent }: StatOrbProps) {
    const b = usePerfMode().blur(24);
  return (
    <div
        className="relative px-5 py-3 rounded-2xl flex items-baseline gap-2.5 transition-transform duration-500 hover:scale-[1.04]"
      style={{
          background: b > 0 ? 'rgb(var(--ink) / 0.04)' : 'rgb(var(--surface-hi) / 0.85)',
        border: '0.5px solid rgb(var(--ink) / 0.08)',
          backdropFilter: b > 0 ? `blur(${b}px)` : undefined,
          WebkitBackdropFilter: b > 0 ? `blur(${b}px)` : undefined,
        boxShadow: `inset 0 0.5px 0 rgba(255,255,255,0.08), 0 8px 24px ${accent}`,
      }}
    >
      <span className="text-[20px] font-black tabular-nums tracking-tight text-ink">
        {value != null ? fc(value) : '—'}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink-40">
        {label}
      </span>
    </div>
  );
}

export const StatOrb = React.memo(StatOrbImpl);
