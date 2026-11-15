import { useMemo } from 'react';
import { bindOf, useBinds, usePlans } from '../../../../lib/binds';
import type { BindState } from '../../../../lib/pay-client';
import { usePersonalOffer } from '../../../../lib/personal-offer';
import { tierPlans } from '../../../../lib/star-shared';
import { useOrderPoll } from '../../../../lib/useOrderPoll';
import { type FlowApi, flowApi } from './actions';
import { phaseOf } from './phase';
import { type Env, offerOf, offerPlans, pickedOf, planIdOf, routeOf, viaBindOf } from './select';
import { type FlowState, type Purchase, useFlow, useFlowStore } from './store';

const BUYING = new Set(['overview', 'method', 'pay', 'card', 'sbp', 'trial']);

export function useFlowApi(): FlowApi {
  return flowApi(useFlowStore());
}

export function useEnv(): Env {
  const data = usePlans().data;
  const offer = usePersonalOffer();
  return useMemo(() => ({ data, offer }), [data, offer]);
}

export function useSel<T>(select: (s: FlowState, env: Env) => T): T {
  const env = useEnv();
  return useFlow((s) => select(s, env));
}

export function useLinking() {
  return useFlow((s) => (s.step === 'card' || s.step === 'sbp' ? s.linking : null));
}

export function useBuying(): boolean {
  return useFlow((s) => BUYING.has(s.step) && !(s.linking && !s.linking.trial));
}

export function useChoosing(): boolean {
  return useFlow((s) => s.step === 'overview' || s.step === 'method');
}

export function useOffer() {
  return useSel(offerOf);
}

export function usePlanList() {
  const tier = useFlow((s) => s.tier);
  const offer = useOffer();
  const query = usePlans();
  const data = query.data;
  const plans = useMemo(
    () => offerPlans(offer, tierPlans(tier, data?.plans ?? [], data?.shared)),
    [offer, tier, data],
  );
  return { plans, loading: query.isLoading, error: query.isError, retry: query.refetch };
}

export function useSelectedPlan() {
  const { plans } = usePlanList();
  const id = useSel(planIdOf);
  return plans.find((p) => p.id === id) ?? null;
}

export function useBindState(): { viaBind: boolean; state: BindState | null } {
  const viaBind = useSel(viaBindOf);
  const picked = useSel(pickedOf);
  const binds = useBinds(viaBind);
  if (!viaBind || !picked) return { viaBind: false, state: null };
  if (binds.data) return { viaBind, state: bindOf(binds.data, picked.id)?.state ?? 'none' };
  return { viaBind, state: binds.isError ? 'none' : null };
}

export function purchaseNow(s: FlowState, env: Env): Purchase | null {
  const route = routeOf(s, env);
  const planId = planIdOf(s, env);
  if (!route || !planId) return null;
  return {
    planId,
    method: route.method.id,
    recurring: route.recurring,
    own: true,
    offerId: offerOf(s, env)?.id ?? null,
  };
}

export function useCurrentOrder() {
  const checkout = useFlow((s) => s.checkout);
  const live = useFlow((s) => s.step === 'pay' || s.step === 'success');
  const timed = checkout?.action?.type === 'qr' || checkout?.action?.type === 'open';
  const poll = useOrderPoll(
    live ? (checkout?.order_id ?? null) : null,
    timed ? checkout.expires_at : null,
  );
  const order = poll.data ?? checkout;
  return { first: checkout, order, phase: phaseOf(order?.status) };
}
