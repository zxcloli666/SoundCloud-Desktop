import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from '../../../../lib/icons';
import { money, monthsOf } from '../../../../lib/offer-format';
import { OfferBar, OfferProof, OfferTimer } from '../../../offer/OfferCopy';
import { useOffer } from '../flow/derive';

export const OfferSlot = memo(function OfferSlot() {
  const { t } = useTranslation();
  const offer = useOffer();
  if (!offer) return null;
  return (
    <div
      data-ui="star-offer"
      className="star-in relative overflow-hidden rounded-[16px] border border-accent/30 bg-accent/10 px-3.5 py-3"
    >
      <div className="relative flex items-center gap-3">
        <Sparkles size={18} className="shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          {offer.proof.plays > 0 && (
            <div className="truncate text-[11px] font-semibold text-accent">
              <OfferProof offer={offer} />
            </div>
          )}
          <div className="truncate text-[13.5px] font-bold text-ink">
            {t(`starOffer.short.${monthsOf(offer)}`, { price: money(offer, offer.price) })}
          </div>
          <div className="text-[11.5px] tabular-nums text-ink-55">
            <OfferTimer endsAt={offer.ends_at} />
          </div>
        </div>
        {offer.list_price && (
          <s className="shrink-0 text-[14px] font-bold tabular-nums text-ink-40">
            {money(offer, offer.list_price)}
          </s>
        )}
      </div>
      {offer.ends_at !== null && (
        <div className="relative mt-2.5">
          <OfferBar offer={offer} />
        </div>
      )}
    </div>
  );
});
