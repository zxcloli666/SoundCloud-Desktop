import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tenure } from '../../lib/star-tenure';
import { StarBadge } from '../layout/StarBadge';

export const LostStreak = memo(function LostStreak({ tenure }: { tenure: Tenure }) {
  const { t } = useTranslation();
  return (
    <div className="mt-3.5 rounded-[14px] border border-ink/[0.08] bg-ink/[0.03] px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[15px] font-bold leading-tight text-ink">
          {t('starTenure.months', { count: tenure.months })}
        </span>
        <span className="shrink-0 text-[11px] text-ink-40">
          {t('starMoments.expiry.streakLost')}
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-2.5">
        <StarBadge size="lg" tier={tenure.tier} />
        <span aria-hidden className="h-0 flex-1 border-t border-dashed border-ink/20" />
        <StarBadge size="lg" tier={0} />
      </div>
    </div>
  );
});
