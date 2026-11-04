import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { type Tenure, useOwnTenure } from '../../../lib/star-tenure';
import { StarBadge } from '../../layout/StarBadge';

const RADIUS = 28;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const TenurePanel = memo(function TenurePanel() {
  const tenure = useOwnTenure();
  if (!tenure) return null;
  return <TenureCard tenure={tenure} />;
});

const TenureCard = memo(function TenureCard({ tenure }: { tenure: Tenure }) {
  const { t } = useTranslation();
  const maxed = tenure.nextTier === null;

  return (
    <div className="flex items-center gap-4 rounded-[14px] border border-ink/[0.08] bg-ink/[0.03] px-4 py-3.5">
      <Ring progress={tenure.progress} maxed={maxed} months={tenure.months} />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-45">
          {t('starTenure.title')}
        </div>
        <div className="mt-0.5 text-[17px] font-bold leading-tight tracking-tight text-ink">
          {t('starTenure.months', { count: tenure.months })}
        </div>
        <div className="mt-0.5 text-[11.5px] text-ink-40">
          {tenure.nextTier === null
            ? t(`starTenure.tier.${tenure.tier}`)
            : t('starTenure.next', {
                count: tenure.monthsToNext,
                tier: t(`starTenure.tier.${tenure.nextTier}`),
              })}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <StarBadge size="lg" tier={tenure.tier} />
        {tenure.nextTier !== null && (
          <div className="flex items-center gap-1.5 opacity-45" style={{ filter: 'saturate(0.6)' }}>
            <span aria-hidden className="font-mono text-[11px] text-ink-45">
              →
            </span>
            <StarBadge size="sm" tier={tenure.nextTier} />
          </div>
        )}
      </div>
    </div>
  );
});

const Ring = memo(function Ring({
  progress,
  maxed,
  months,
}: {
  progress: number;
  maxed: boolean;
  months: number;
}) {
  const offset = CIRCUMFERENCE * (1 - Math.min(1, Math.max(0.02, progress)));
  const stroke = maxed ? '#fcd34d' : 'var(--color-accent)';
  return (
    <div className="relative grid size-[68px] shrink-0 place-items-center">
      <svg viewBox="0 0 68 68" className="absolute inset-0 -rotate-90">
        <circle cx="34" cy="34" r={RADIUS} fill="none" stroke="rgb(var(--ink) / 0.08)" strokeWidth="5" />
        <circle
          cx="34"
          cy="34"
          r={RADIUS}
          fill="none"
          stroke={stroke}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none"
          style={{ filter: `drop-shadow(0 0 5px ${maxed ? 'rgba(252,211,77,0.7)' : 'var(--color-accent-glow)'})` }}
        />
      </svg>
      <span className="relative font-mono text-[20px] font-bold leading-none text-ink">{months}</span>
    </div>
  );
});
