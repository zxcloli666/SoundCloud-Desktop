import { memo } from 'react';
import { TrendingDown, TrendingUp } from '../../../lib/icons';

export const DeltaChip = memo(function DeltaChip({
  value,
  label,
}: {
  value: number | null;
  label?: string;
}) {
  if (value == null) return null;
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      title={label}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
        up ? 'bg-ok/10 text-ok' : 'bg-ink/[0.06] text-ink-50'
      }`}
    >
      <Icon size={12} />
      {up ? '+' : '−'}
      {Math.abs(value)}%
    </span>
  );
});
