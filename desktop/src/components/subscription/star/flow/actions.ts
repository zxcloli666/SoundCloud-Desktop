import { toast } from 'sonner';
import i18n from '../../../../i18n';
import { refreshBinds } from '../../../../lib/binds';
import {
  type BindFlow,
  type MethodId,
  type Order,
  payApi,
  payErrorCode,
  type Renewal,
  type TierId,
} from '../../../../lib/pay-client';
import { queryClient } from '../../../../lib/query-client';
import { refreshSubscription } from '../../../../lib/star-offer';
import { refreshShared, sharedErrorKey } from '../../../../lib/star-shared';
import type { TrialOutcome } from '../../../../lib/star-trial';
import type { Recipient, Step } from '../meta';
import { GIFTS_KEY, PLANS_KEY } from './keys';
import { type FlowStore, isGift, type Purchase, type RefBonus } from './store';

const NEEDS_LINK = new Set(['bind_needed', 'relink']);

export function payErrorText(error: unknown): string {
  return i18n.t(payErrorCode(error) ? sharedErrorKey(error) : 'starpass.checkoutError');
}

function makeApi(store: FlowStore) {
  const { getState: get, setState: set } = store;

  const setStep = (step: Step) => set({ step });

  const goMethod = () => set({ checkout: null, payError: null, step: 'method' });

  const placeOrder = async (p: Purchase) => {
    const s = get();
    const gift = isGift(s);
    set({ paying: true, payError: null, lastPurchase: p });
    try {
      const order = await payApi.checkout({
        plan_id: p.planId,
        method: p.method,
        recurring: p.recurring,
        idempotency_key: crypto.randomUUID(),
        gift: (p.own && gift) || undefined,
        tier: p.own && s.tier !== 'solo' ? s.tier : undefined,
        ref: p.own && !gift && !p.offerId && s.refBonus ? s.refBonus.code : undefined,
        offer_id: p.own ? (p.offerId ?? undefined) : undefined,
      });
      set({ paying: false, checkout: order, step: 'pay' });
    } catch (error) {
      set({ paying: false, payError: error });
      if (get().step === 'pay') set({ step: 'method' });
      if (NEEDS_LINK.has(payErrorCode(error) ?? '')) refreshBinds();
      if (p.own) return;
      set({ step: 'manage' });
      toast.error(payErrorText(error));
    }
  };

  const trialDone = (outcome: TrialOutcome | null) => {
    refreshSubscription();
    if (outcome?.kind === 'granted') {
      set({ step: 'success' });
      return;
    }
    set({ trialBlocked: outcome?.kind === 'refused' ? outcome.refusal : 'failed', step: 'trial' });
  };

  return {
    setStep,
    goMethod,
    placeOrder,
    trialDone,
    changeTier: (tier: TierId) =>
      set(tier === 'solo' ? { tier } : { tier, recipient: 'self' as Recipient }),
    setRecipient: (recipient: Recipient) => set({ recipient }),
    pickPlan: (planId: string) => set({ planId }),
    pickMethod: (methodId: MethodId) => set({ methodId }),
    setRenew: (renewPref: boolean) => set({ renewPref }),
    setRefBonus: (refBonus: RefBonus) => set({ refBonus }),
    extend: () => set({ recipient: 'self', step: 'overview' }),
    giftMore: () => set({ recipient: 'gift', step: 'overview' }),
    relinkAndPay: () => {
      refreshBinds();
      goMethod();
    },
    retryLast: () => {
      const last = get().lastPurchase;
      if (last) void placeOrder(last);
    },
    payNow: (p: Purchase) => {
      set({ step: 'method' });
      void placeOrder(p);
    },
    payOnce: (p: Purchase) => {
      set({ renewPref: false, step: 'method' });
      void placeOrder({ ...p, recurring: false });
    },
    granted: (order: Order) => {
      set({ step: 'success' });
      if (get().tier !== 'solo') refreshShared();
      if (order.gift) void queryClient.invalidateQueries({ queryKey: GIFTS_KEY });
    },
    confirmRenewal: async (renewal: Renewal) => {
      const loaded = await queryClient
        .fetchQuery({ queryKey: PLANS_KEY, queryFn: payApi.plans, staleTime: 300_000 })
        .catch(() => null);
      const solo = loaded?.plans ?? [];
      const plan =
        solo.find((p) => p.period_days === renewal.period_days) ?? solo.find((p) => p.months === 1);
      if (!plan) {
        toast.error(i18n.t('starpass.checkoutError'));
        return;
      }
      set({ tier: 'solo', recipient: 'self', planId: plan.id, methodId: renewal.method });
      await placeOrder({
        planId: plan.id,
        method: renewal.method,
        recurring: true,
        own: false,
        offerId: null,
      });
    },
    startLink: (method: MethodId, flow: BindFlow, trial: boolean) =>
      set({ linking: { method, flow, trial }, step: flow === 'qr' ? 'sbp' : 'card' }),
    endLink: (outcome: TrialOutcome | null) => {
      const trial = get().linking?.trial;
      set({ linking: null });
      refreshBinds();
      if (trial) trialDone(outcome);
      else setStep('manage');
    },
    leaveLink: () => {
      const trial = get().linking?.trial;
      set({ linking: null, step: trial ? 'trial' : 'manage' });
      refreshBinds();
    },
    openLink: (flow: BindFlow) => set({ linking: null, step: flow === 'qr' ? 'sbp' : 'card' }),
    openTrial: () => set({ trialBlocked: null, step: 'trial' }),
    pickTrial: (trialMethod: MethodId) => set({ trialMethod }),
    askTrial: (askTrial: boolean) => set({ askTrial }),
  };
}

export type FlowApi = ReturnType<typeof makeApi>;

const apis = new WeakMap<FlowStore, FlowApi>();

export function flowApi(store: FlowStore): FlowApi {
  let api = apis.get(store);
  if (!api) {
    api = makeApi(store);
    apis.set(store, api);
  }
  return api;
}
