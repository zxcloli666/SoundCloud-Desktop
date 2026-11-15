import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { monthsOf } from '../../../lib/offer-format';
import type { Currency, PayOffer } from '../../../lib/pay-client';
import { chargeAmount, priceIn } from '../../../lib/star-format';

export const OfferCaption = memo(function OfferCaption({
  offer,
  currency,
}: {
  offer: PayOffer;
  currency: Currency;
}) {
  const { t } = useTranslation();
  const renews = offer.renews_at_price;
  const months = monthsOf(offer);
  if (!renews) return <>{t(`starOffer.readout.${months === 'one' ? 'plainOne' : 'plainTwo'}`)}</>;
  const { amount, currency: shown } = priceIn(renews, currency);
  return <>{t(`starOffer.readout.${months}`, { price: chargeAmount(amount, shown) })}</>;
});
