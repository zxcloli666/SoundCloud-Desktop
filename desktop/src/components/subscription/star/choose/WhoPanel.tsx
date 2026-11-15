import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlans } from '../../../../lib/binds';
import { Gift, Star, User, Users } from '../../../../lib/icons';
import type { TierId } from '../../../../lib/pay-client';
import { chargeAmount, priceIn } from '../../../../lib/star-format';
import { perPerson, useSharedOverview } from '../../../../lib/star-shared';
import { useFlowApi, useOffer, useSel } from '../flow/derive';
import { currencyIn, planIdOf } from '../flow/select';
import { useFlow } from '../flow/store';
import { Panel } from '../ui/Panel';
import { ON } from './styles';

interface TierOption {
  id: TierId;
  people: number;
  each: string;
  was: string | null;
  savePct: number;
}

function useTierOptions(): TierOption[] {
  const data = usePlans().data;
  const planId = useSel(planIdOf);
  const currency = useSel(currencyIn);
  const offer = useOffer();
  return useMemo(() => {
    const list = data?.plans.find((p) => p.id === planId);
    const solo = list && offer ? { ...list, price: offer.price } : list;
    const own = solo?.price;
    const was = offer?.list_price;
    const price = (p: typeof own) => {
      if (!p) return '';
      const { amount, currency: shown } = priceIn(p, currency);
      return chargeAmount(amount, shown);
    };
    return [
      { id: 'solo', people: 1, each: price(own), was: was ? price(was) : null, savePct: 0 },
      ...(data?.shared ?? []).map((s) => ({
        id: s.tier,
        people: s.seats + 1,
        was: null,
        ...perPerson(
          s.plans.find((p) => p.id === planId),
          solo,
          s.seats,
          currency,
        ),
      })),
    ];
  }, [data, planId, currency, offer]);
}

export const WhoPanel = memo(function WhoPanel() {
  const { t } = useTranslation();
  const member = useSharedOverview().data?.role === 'member';
  if (member) {
    return (
      <Panel data-ui="star-who">
        <p className="text-[13px] text-ink-60">{t('starpass.shared.memberBuy')}</p>
      </Panel>
    );
  }
  return (
    <Panel data-ui="star-who">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold text-ink-45">{t('starpass.forWhom')}</span>
        <RecipientSwitch />
      </div>
      <TierTiles />
    </Panel>
  );
});

const RecipientSwitch = memo(function RecipientSwitch() {
  const { t } = useTranslation();
  const solo = useFlow((s) => s.tier === 'solo');
  const recipient = useFlow((s) => s.recipient);
  const api = useFlowApi();
  if (!solo) return null;
  return (
    <div className="flex gap-1 rounded-full bg-ink/[0.05] p-0.5">
      {(['self', 'gift'] as const).map((id) => {
        const on = recipient === id;
        const Icon = id === 'self' ? Star : Gift;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            data-recipient={id}
            onClick={() => api.setRecipient(id)}
            className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-colors duration-200 ${on ? 'bg-surface text-ink shadow-sm' : 'text-ink-50 hover:text-ink-85'}`}
          >
            <Icon size={12} className={on ? 'text-accent' : undefined} />
            {t(`starpass.recipient.${id}`)}
          </button>
        );
      })}
    </div>
  );
});

const TierTiles = memo(function TierTiles() {
  const { t } = useTranslation();
  const tier = useFlow((s) => s.tier);
  const options = useTierOptions();
  const api = useFlowApi();
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((o) => {
        const on = o.id === tier;
        const Icon = o.people > 1 ? Users : User;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            data-tier={o.id}
            onClick={() => api.changeTier(o.id)}
            className="min-w-0 cursor-pointer rounded-[14px] bg-ink/[0.035] px-3 py-2.5 text-left transition-[background-color,box-shadow] duration-200 hover:bg-ink/[0.06]"
            style={on ? ON : undefined}
          >
            <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-ink-90">
              <Icon size={14} className={on ? 'text-accent' : 'text-ink-45'} />
              {t(`starpass.tier.${o.id}`)}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11.5px] tabular-nums text-ink-50">
              {o.people > 1 && o.each
                ? t('starpass.tier.each', { price: o.each })
                : o.was
                  ? o.each
                  : t('starpass.tier.people', { count: o.people })}
              {o.was && <s className="text-ink-35">{o.was}</s>}
              {o.savePct > 0 && (
                <span className="font-bold text-accent">
                  {t('starpass.tier.save', { pct: o.savePct })}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
});
