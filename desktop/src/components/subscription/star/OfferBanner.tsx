import { memo } from 'react';
import type { PayOffer } from '../../../lib/pay-client';
import {
  OfferBar,
  OfferHeadline,
  OfferProof,
  OfferRenews,
  OfferTimer,
} from '../../offer/OfferCopy';

export const OfferBanner = memo(function OfferBanner({ offer }: { offer: PayOffer }) {
  return (
    <div
      data-ui="offer-banner"
      className="mb-3.5 rounded-[14px] border border-accent/30 bg-ink/[0.03] px-4 py-3"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
        <OfferProof offer={offer} />
      </div>
      <div className="mt-1">
        <OfferHeadline offer={offer} size="md" />
      </div>
      <div className="mt-0.5 text-[11.5px] text-ink-45">
        <OfferRenews offer={offer} />
      </div>
      <div className="mt-2.5">
        <OfferBar offer={offer} />
      </div>
      <div className="mt-1.5 text-[11px] text-ink-45">
        <OfferTimer endsAt={offer.ends_at} />
      </div>
    </div>
  );
});
