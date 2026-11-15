import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  clock,
  isLastDay,
  leftShare,
  money,
  monthsOf,
  renewalAt,
  useOfferNow,
} from '../../lib/offer-format';
import type { PayOffer } from '../../lib/pay-client';
import { passDate } from '../../lib/star-format';

export const OfferProof = memo(function OfferProof({ offer }: { offer: PayOffer }) {
  const { t } = useTranslation();
  if (offer.proof.plays <= 0) return null;
  return <>{t('starOffer.proof', { count: offer.proof.plays })}</>;
});

export const OfferHeadline = memo(function OfferHeadline({
  offer,
  size = 'lg',
}: {
  offer: PayOffer;
  size?: 'md' | 'lg';
}) {
  const { t } = useTranslation();
  return (
    <span className={size === 'lg' ? 'text-[19px]' : 'text-[15px]'}>
      <span className="font-bold leading-tight tracking-tight text-ink">
        {t(`starOffer.first.${monthsOf(offer)}`, { price: money(offer, offer.price) })}
      </span>
      {offer.list_price && (
        <s className="ml-2 text-[12px] font-medium tabular-nums text-ink-40">
          {money(offer, offer.list_price)}
        </s>
      )}
    </span>
  );
});

export const OfferRenews = memo(function OfferRenews({ offer }: { offer: PayOffer }) {
  const { t } = useTranslation();
  if (!offer.renews_at_price) return null;
  return (
    <>
      {t('starOffer.renews', {
        price: money(offer, offer.renews_at_price),
        date: passDate(renewalAt(offer)),
      })}
    </>
  );
});

export const OfferTimer = memo(function OfferTimer({ endsAt }: { endsAt: number | null }) {
  const { t } = useTranslation();
  const now = useOfferNow(endsAt);
  if (endsAt === null) return null;
  if (isLastDay(endsAt, now)) {
    return (
      <span className="tabular-nums">
        {t('starOffer.left', { time: clock(endsAt * 1000 - now) })}
      </span>
    );
  }
  return <>{t('starOffer.until', { date: passDate(endsAt) })}</>;
});

export const OfferBar = memo(function OfferBar({ offer }: { offer: PayOffer }) {
  const now = useOfferNow(offer.ends_at);
  return (
    <span className="block h-1 w-full overflow-hidden rounded-full bg-ink/[0.08]">
      <span
        className="block h-full origin-left rounded-full bg-accent transition-transform duration-1000 ease-linear"
        style={{ transform: `scaleX(${leftShare(offer, now)})` }}
      />
    </span>
  );
});
