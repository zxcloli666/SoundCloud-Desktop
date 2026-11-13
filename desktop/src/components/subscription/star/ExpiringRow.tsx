import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from '../../../lib/icons';
import { SOON_DAYS, type StarEnds } from '../../../lib/star-status';
import { PrimaryBtn } from './StarConsole';

const TONE = {
  calm: { text: 'text-ink', fill: 'bg-accent' },
  soon: { text: 'text-amber-400', fill: 'bg-amber-400' },
  urgent: { text: 'text-bad', fill: 'bg-bad' },
} as const;

export const ExpiringRow = memo(function ExpiringRow({
  ending,
  onExtend,
}: {
  ending: StarEnds;
  onExtend: () => void;
}) {
  const { t } = useTranslation();
  const tone = TONE[ending.level];

  return (
    <div className="flex items-center justify-between gap-4 rounded-[14px] border border-ink/[0.08] bg-ink/[0.03] px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className={`text-[17px] font-bold leading-tight tabular-nums ${tone.text}`}>
          {t('starMoments.expiry.left', { count: ending.days })}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/[0.08]">
          <span
            className={`block h-full rounded-full ${tone.fill}`}
            style={{ width: `${(ending.days / SOON_DAYS) * 100}%` }}
          />
        </div>
      </div>
      <PrimaryBtn onClick={onExtend}>
        <Star size={14} fill="currentColor" />
        {t(ending.trial ? 'starMoments.getStar' : 'starpass.manage.extend')}
      </PrimaryBtn>
    </div>
  );
});
