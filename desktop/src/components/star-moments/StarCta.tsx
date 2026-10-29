import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from '../../lib/icons';
import { type StarIntent, TRIAL_DAYS, useOpenStar, useStarOffer } from '../../lib/star-offer';

const LABEL: Record<StarIntent, string> = {
  trial: 'starMoments.tryFree',
  buy: 'starMoments.getStar',
  extend: 'starMoments.extend',
  gift: 'starMoments.gift',
  invite: 'starMoments.invite',
};

/** The one STAR call to action: a free trial when the account still has one, else the pass. */
export const StarCta = memo(function StarCta({
  intent,
  onOpen,
  size = 'md',
}: {
  intent?: StarIntent;
  onOpen?: () => void;
  size?: 'sm' | 'md';
}) {
  const { t } = useTranslation();
  const { trial } = useStarOffer();
  const openStar = useOpenStar();
  const wanted = intent ?? (trial ? 'trial' : 'buy');
  const label = t(LABEL[wanted], { count: TRIAL_DAYS });

  return (
    <button
      type="button"
      onClick={() => {
        onOpen?.();
        openStar(wanted);
      }}
      className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full font-semibold text-accent-contrast transition-transform duration-200 ease-[var(--ease-apple)] hover:-translate-y-px active:scale-[0.97] ${
        size === 'sm' ? 'px-3 py-1.5 text-[11.5px]' : 'px-4 py-2 text-[12.5px]'
      }`}
      style={{
        background: 'linear-gradient(180deg, var(--color-accent-hover), var(--color-accent))',
        boxShadow: '0 0 22px -6px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.35)',
      }}
    >
      <Star size={size === 'sm' ? 11 : 13} fill="currentColor" />
      {label}
    </button>
  );
});
