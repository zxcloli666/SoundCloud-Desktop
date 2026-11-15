import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { chargeAmount, passDate } from '../../../../lib/star-format';
import { tileOf } from '../../methods';
import { useTrialStep } from '../trial/useTrialStep';
import { Line } from './Line';
import { Lines } from './Lines';
import { Total } from './Total';

const DAY_SECS = 86_400;

export const TrialLines = memo(function TrialLines() {
  const { t } = useTranslation();
  const { offer, method, blocked } = useTrialStep();
  const days = offer?.days ?? 0;
  if (blocked || !offer?.available) return <Lines />;
  return (
    <div data-ui="star-receipt-lines" className="flex flex-col gap-2.5">
      <Line label={t('starpass.forWhom')}>{t('starpass.tier.solo')}</Line>
      <Line label={t('starpass.term')}>
        {days ? t('starpass.trial.cta', { count: days }) : '—'}
      </Line>
      <Line label={t('starpass.providerTitle')}>
        {method ? t(`starpass.method.${tileOf(method).i18n}.title`) : '—'}
      </Line>
      <Line label={t('starpass.renew.title')}>
        {days ? passDate(Math.floor(Date.now() / 1000) + days * DAY_SECS) : '—'}
      </Line>
    </div>
  );
});

export const TrialTotal = memo(function TrialTotal() {
  const { t } = useTranslation();
  const { amount, currency, offer, blocked } = useTrialStep();
  if (blocked || !offer?.available) return <Total />;
  return (
    <div data-ui="star-total" className="flex items-end justify-between gap-3">
      <span className="text-[13px] text-ink-45">{t('starpass.toPay')}</span>
      <span className="min-w-0 text-right">
        <span className="block text-[30px] font-extrabold leading-none tracking-tight tabular-nums text-ink">
          {chargeAmount(0, currency)}
        </span>
        {amount && (
          <span className="mt-1 block text-[11.5px] tabular-nums text-ink-45">
            {t('starpass.trial.then', { amount })}
          </span>
        )}
      </span>
    </div>
  );
});
