import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOpenStar } from '../../lib/star-offer';
import { YEAR_PLAN_ID, useYearOffer } from '../../lib/star-year';

export const YearCta = memo(function YearCta({
  onOpen,
  size = 'md',
}: {
  onOpen?: () => void;
  size?: 'sm' | 'md';
}) {
  const { t } = useTranslation();
  const openStar = useOpenStar();
  const offer = useYearOffer();
  if (!offer) return null;

  return (
    <button
      type="button"
      onClick={() => {
        onOpen?.();
        openStar('extend', YEAR_PLAN_ID);
      }}
      className={`group inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-accent/40 bg-accent/10 font-semibold text-ink-90 transition-all duration-200 ease-[var(--ease-apple)] hover:-translate-y-px hover:border-accent/70 hover:bg-accent/20 active:scale-[0.97] ${
        size === 'sm' ? 'px-3 py-1.5 text-[11.5px]' : 'px-4 py-2 text-[12.5px]'
      }`}
    >
      {t('starMoments.year.cta')}
      <span className="rounded-full bg-accent px-1.5 py-px font-mono text-[10px] font-bold text-accent-contrast">
        −{offer.plan.savings_pct}%
      </span>
      <span className="font-mono text-[10.5px] text-ink-45 group-hover:text-ink-70">
        {t('starMoments.year.saved', { sum: offer.savedRub })}
      </span>
    </button>
  );
});
