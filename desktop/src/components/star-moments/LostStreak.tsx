import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tenure } from '../../lib/star-tenure';
import { StarBadge } from '../layout/StarBadge';

export const LostStreak = memo(function LostStreak({ tenure }: { tenure: Tenure }) {
  const { t } = useTranslation();
  return (
    <div className="mt-3.5 flex items-center gap-3 rounded-[14px] border border-ink/[0.08] bg-ink/[0.03] px-3 py-2.5">
      <StarBadge size="lg" tier={tenure.tier} />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold leading-tight text-ink">
          {t('starTenure.months', { count: tenure.months })}
        </div>
        <div className="text-[11px] text-ink-40">{t('starMoments.expiry.streakLost')}</div>
      </div>
      <span aria-hidden className="font-mono text-[18px] leading-none text-ink-25">
        →
      </span>
      <StarBadge size="lg" tier={0} />
    </div>
  );
});
