import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { perMonth } from '../../../../lib/star-format';
import { useOffer, useSel, useSelectedPlan } from '../flow/derive';
import { amountOf, currencyIn } from '../flow/select';
import { useFlow } from '../flow/store';
import { OfferCaption } from '../OfferCaption';

export const Total = memo(function Total() {
  const { t } = useTranslation();
  const amount = useSel(amountOf);
  const currency = useSel(currencyIn);
  const plan = useSelectedPlan();
  const offer = useOffer();
  const paid = useFlow((s) => s.step === 'success');
  return (
    <div data-ui="star-total" className="flex items-end justify-between gap-3">
      <span className="text-[13px] text-ink-45">
        {t(paid ? 'starpass.paidTotal' : 'starpass.toPay')}
      </span>
      <span className="min-w-0 text-right">
        <span
          key={amount}
          className="star-in block text-[30px] font-extrabold leading-none tracking-tight tabular-nums text-ink"
        >
          {amount || '—'}
        </span>
        {offer ? (
          <span className="mt-1 block text-[11.5px] tabular-nums text-ink-45">
            <OfferCaption offer={offer} currency={currency} />
          </span>
        ) : (
          plan &&
          plan.months > 1 && (
            <span className="mt-1 block text-[11.5px] tabular-nums text-ink-45">
              {perMonth(plan, currency)}
              {t('starpass.perMonth')}
            </span>
          )
        )}
      </span>
    </div>
  );
});
