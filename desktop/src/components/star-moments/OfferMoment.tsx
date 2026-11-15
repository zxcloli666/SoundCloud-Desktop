import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Star } from '../../lib/icons';
import { money } from '../../lib/offer-format';
import { useOfferPeaks } from '../../lib/offer-peaks';
import type { PayOffer } from '../../lib/pay-client';
import { dismissOffer, useOfferShown, usePersonalOffer } from '../../lib/personal-offer';
import { useOpenStar } from '../../lib/star-offer';
import { useOfferPeak } from '../../stores/offer-peak';
import { OfferBar, OfferHeadline, OfferProof, OfferRenews, OfferTimer } from '../offer/OfferCopy';
import { MomentCard } from './MomentCard';

export function useOfferMoment(): PayOffer | null {
  const offer = usePersonalOffer();
  const raised = useOfferPeak((s) => s.raised);
  const onStarPage = useLocation().pathname === '/star';
  useOfferPeaks(offer !== null);
  return offer && raised && !onStarPage ? offer : null;
}

export const OfferMoment = memo(function OfferMoment({ offer }: { offer: PayOffer }) {
  const { t } = useTranslation();
  const openStar = useOpenStar();
  useOfferShown(offer);

  const take = () => {
    useOfferPeak.getState().clear();
    openStar('buy', undefined, offer.id);
  };

  return (
    <MomentCard onClose={() => dismissOffer(offer.id)}>
      <div data-ui="offer-moment" className="pr-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
          <OfferProof offer={offer} />
        </div>
        <div className="mt-1.5">
          <OfferHeadline offer={offer} />
        </div>
        <div className="mt-1 text-[11.5px] text-ink-45">
          <OfferRenews offer={offer} />
        </div>
      </div>
      <div className="mt-3">
        <OfferBar offer={offer} />
      </div>
      <div className="mt-3.5 flex items-center justify-between gap-2">
        <span className="text-[11.5px] text-ink-45">
          <OfferTimer endsAt={offer.ends_at} />
        </span>
        <button
          type="button"
          onClick={take}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold text-accent-contrast transition-transform duration-200 ease-[var(--ease-apple)] hover:-translate-y-px active:scale-[0.97]"
          style={{
            background: 'linear-gradient(180deg, var(--color-accent-hover), var(--color-accent))',
            boxShadow:
              '0 0 22px -6px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.35)',
          }}
        >
          <Star size={13} fill="currentColor" />
          {t('starOffer.take', { price: money(offer, offer.price) })}
        </button>
      </div>
    </MomentCard>
  );
});
