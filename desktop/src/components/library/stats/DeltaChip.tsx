import { memo } from 'react';
import { type Aura, auraRgb, auraRgba } from '../../../lib/aura';
import { TrendingDown, TrendingUp } from '../../../lib/icons';

export const DeltaChip = memo(function DeltaChip({
  value,
  aura,
  label,
}: {
  value: number | null;
  aura: Aura;
  label?: string;
}) {
  if (value == null) return null;
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      title={label}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums"
      style={
        up
          ? { color: auraRgb(aura), background: auraRgba(aura, 0.14) }
          : { color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)' }
      }
    >
      <Icon size={12} />
      {up ? '+' : '−'}
      {Math.abs(value)}%
    </span>
  );
});
