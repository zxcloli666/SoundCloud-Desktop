import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOwnTenure } from '../../../../lib/star-tenure';
import { StarBadge } from '../../../layout/StarBadge';
import { Panel } from '../ui/Panel';

const R = 28;
const C = 2 * Math.PI * R;
const GOLD = '#fcd34d';

export const Tenure = memo(function Tenure() {
  const { t } = useTranslation();
  const tenure = useOwnTenure();
  if (!tenure) return null;
  const maxed = tenure.nextTier === null;
  const stroke = maxed ? GOLD : 'var(--color-accent)';
  return (
    <Panel data-ui="star-tenure" className="flex items-center gap-4">
      <div className="relative grid size-[68px] shrink-0 place-items-center">
        <svg viewBox="0 0 68 68" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle
            cx="34"
            cy="34"
            r={R}
            fill="none"
            stroke="rgb(var(--ink) / 0.08)"
            strokeWidth="6"
          />
          <circle
            cx="34"
            cy="34"
            r={R}
            fill="none"
            stroke={stroke}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - Math.min(1, Math.max(0.02, tenure.progress)))}
            className="transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none"
          />
        </svg>
        <span className="relative text-[22px] font-extrabold leading-none tabular-nums text-ink">
          {tenure.months}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold text-ink-45">{t('starTenure.title')}</div>
        <div className="mt-0.5 text-[18px] font-extrabold leading-tight tracking-tight text-ink">
          {t('starTenure.months', { count: tenure.months })}
        </div>
        <div className="mt-0.5 text-[12px] text-ink-45">
          {maxed
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
          <span className="flex items-center gap-1.5 opacity-50">
            <span aria-hidden className="text-[11px] text-ink-45">
              →
            </span>
            <StarBadge size="sm" tier={tenure.nextTier} />
          </span>
        )}
      </div>
    </Panel>
  );
});
