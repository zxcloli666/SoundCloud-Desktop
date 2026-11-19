import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from '../../../../lib/icons';
import type { Currency, PayOffer, Plan } from '../../../../lib/pay-client';
import { usePremium } from '../../../../lib/premium-cache';
import { chargeAmount, passDate, perMonth, planPrice, priceIn } from '../../../../lib/star-format';
import { useSharedPreview } from '../../../../lib/star-shared';
import { useFlowApi, useOffer, usePlanList, useSel } from '../flow/derive';
import { currencyIn, planIdOf } from '../flow/select';
import { useFlow } from '../flow/store';
import { monthsKey } from '../meta';
import { OfferCaption } from '../OfferCaption';
import { Label, Panel } from '../ui/Panel';
import { ON } from './styles';

export const TermPanel = memo(function TermPanel() {
  const { t } = useTranslation();
  const { plans, loading, error, retry } = usePlanList();
  return (
    <Panel data-ui="star-term">
      <Label>{t('starpass.term')}</Label>
      {error ? (
        <button
          type="button"
          onClick={() => void retry()}
          className="cursor-pointer text-[13px] font-semibold text-bad"
        >
          {t('starpass.loadError')} · {t('starpass.retry')}
        </button>
      ) : (
        <PlanTiles plans={plans} loading={loading} />
      )}
      <Carry />
    </Panel>
  );
});

const PlanTiles = memo(function PlanTiles({ plans, loading }: { plans: Plan[]; loading: boolean }) {
  const planId = useSel(planIdOf);
  const currency = useSel(currencyIn);
  const offer = useOffer();
  const api = useFlowApi();
  return (
    <div className={`grid gap-2 ${plans.length === 1 ? 'grid-cols-1' : 'grid-cols-3'}`}>
      {loading &&
        [0, 1, 2].map((i) => (
          <div key={i} className="h-[104px] animate-pulse rounded-[16px] bg-ink/[0.05]" />
        ))}
      {plans.map((p) => (
        <PlanTile
          key={p.id}
          plan={p}
          on={p.id === planId}
          currency={currency}
          offer={offer}
          onPick={api.pickPlan}
        />
      ))}
    </div>
  );
});

const PlanTile = memo(function PlanTile({
  plan,
  on,
  currency,
  offer,
  onPick,
}: {
  plan: Plan;
  on: boolean;
  currency: Currency;
  offer: PayOffer | null;
  onPick: (id: string) => void;
}) {
  const { t } = useTranslation();
  const was = offer?.list_price ? priceIn(offer.list_price, currency) : null;
  return (
    <button
      type="button"
      aria-pressed={on}
      data-plan={plan.id}
      onClick={() => onPick(plan.id)}
      className="relative min-w-0 cursor-pointer rounded-[16px] bg-ink/[0.035] px-3.5 py-3 text-left transition-[background-color,box-shadow,transform] duration-200 ease-[var(--ease-apple)] hover:-translate-y-0.5 hover:bg-ink/[0.06]"
      style={on ? ON : undefined}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-[12.5px] font-semibold text-ink-60">
          {t(`starpass.plan.${monthsKey(plan.months)}`)}
        </span>
        {plan.savings_pct > 0 && (
          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums text-accent-contrast">
            −{plan.savings_pct}%
          </span>
        )}
      </span>
      <span className="mt-2 flex items-baseline gap-2">
        <span className="text-[24px] font-extrabold leading-none tracking-tight tabular-nums text-ink">
          {planPrice(plan, currency)}
        </span>
        {was && (
          <s className="text-[13px] font-semibold tabular-nums text-ink-35">
            {chargeAmount(was.amount, was.currency)}
          </s>
        )}
      </span>
      <span className="mt-1.5 block truncate pr-6 text-[11.5px] tabular-nums text-ink-45">
        {offer ? (
          <OfferCaption offer={offer} currency={currency} />
        ) : plan.months > 1 ? (
          `${perMonth(plan, currency)}${t('starpass.perMonth')}`
        ) : (
          ' '
        )}
      </span>
      <span
        className="absolute bottom-3 right-3 grid size-5 place-items-center rounded-full bg-accent text-accent-contrast transition-[opacity,transform] duration-200"
        style={{ opacity: on ? 1 : 0, transform: `scale(${on ? 1 : 0.5})` }}
      >
        <Check size={12} strokeWidth={3.2} />
      </span>
    </button>
  );
});

const Carry = memo(function Carry() {
  const { t } = useTranslation();
  const premium = usePremium();
  const tier = useFlow((s) => s.tier);
  const planId = useSel(planIdOf);
  const preview = useSharedPreview(tier, planId, premium).data;
  if (tier === 'solo' || !preview || preview.carry_days <= 0) return null;
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-[12px] bg-ink/[0.04] px-3.5 py-2.5 text-[12.5px]">
      <span className="text-ink-70">{t('starpass.shared.carryTitle')}</span>
      <span className="font-bold tabular-nums text-accent">
        {t('starpass.shared.carryDays', { count: preview.carry_days })} ·{' '}
        {passDate(preview.ends_at)}
      </span>
    </div>
  );
});
