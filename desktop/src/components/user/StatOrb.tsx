import React from 'react';
import { fc } from '../../lib/formatters';

interface StatOrbProps {
  value: number | null | undefined;
  label: string;
}

function StatOrbImpl({ value, label }: StatOrbProps) {
  return (
    <div className="flex items-baseline gap-2.5 rounded-2xl border border-ink/[0.08] bg-ink/[0.04] px-5 py-3">
      <span className="text-[20px] font-bold tabular-nums tracking-tight text-ink">
        {value != null ? fc(value) : '—'}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-40">
        {label}
      </span>
    </div>
  );
}

export const StatOrb = React.memo(StatOrbImpl);
