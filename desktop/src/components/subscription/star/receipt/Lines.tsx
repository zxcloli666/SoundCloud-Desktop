import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { passDate } from '../../../../lib/star-format';
import { tileOf } from '../../methods';
import { useSel } from '../flow/derive';
import { offerOf, periodDaysOf, pickedOf, routeOf, selectedPlanOf } from '../flow/select';
import { isGift, useFlow } from '../flow/store';
import { monthsKey } from '../meta';
import { Line } from './Line';

const DAY_SECS = 86_400;

export const Lines = memo(function Lines() {
  return (
    <div data-ui="star-receipt-lines" className="flex flex-col gap-2.5">
      <WhoLine />
      <TermLine />
      <MethodLine />
      <RenewLine />
      <RefLine />
    </div>
  );
});

const WhoLine = memo(function WhoLine() {
  const { t } = useTranslation();
  const gift = useFlow(isGift);
  const tier = useFlow((s) => s.tier);
  return (
    <Line label={t('starpass.forWhom')}>
      {t(gift ? 'starpass.recipient.gift' : `starpass.tier.${tier}`)}
    </Line>
  );
});

const TermLine = memo(function TermLine() {
  const { t } = useTranslation();
  const months = useSel((s, e) => selectedPlanOf(s, e)?.months ?? 0);
  return (
    <Line label={t('starpass.term')}>{months ? t(`starpass.plan.${monthsKey(months)}`) : '—'}</Line>
  );
});

const MethodLine = memo(function MethodLine() {
  const { t } = useTranslation();
  const method = useSel((s, e) => pickedOf(s, e)?.id ?? null);
  return (
    <Line label={t('starpass.providerTitle')}>
      {method ? t(`starpass.method.${tileOf(method).i18n}.title`) : '—'}
    </Line>
  );
});

const RenewLine = memo(function RenewLine() {
  const { t } = useTranslation();
  const on = useSel((s, e) => routeOf(s, e)?.recurring === true);
  const days = useSel(periodDaysOf);
  return (
    <Line label={t('starpass.renew.title')}>
      {on ? passDate(Math.floor(Date.now() / 1000) + days * DAY_SECS) : '—'}
    </Line>
  );
});

const RefLine = memo(function RefLine() {
  const { t } = useTranslation();
  const days = useSel((s, e) => (s.refBonus && !isGift(s) && !offerOf(s, e) ? s.refBonus.days : 0));
  if (!days) return null;
  return (
    <Line label={t('starpass.invite.cta')}>
      <span className="text-accent">{t('starpass.ref.applied', { days })}</span>
    </Line>
  );
});
