import type {
  Currency,
  PayMethod,
  PayOffer,
  Plan,
  PlansResponse,
} from '../../../../lib/pay-client';
import { planPrice } from '../../../../lib/star-format';
import { tierPlans } from '../../../../lib/star-shared';
import {
  chooseRoute,
  currencyOf,
  hasOnce,
  payMethods,
  type Route,
  type RouteContext,
  renewable,
  usable,
} from '../../methods';
import { type FlowState, isGift } from './store';

export interface Env {
  data: PlansResponse | undefined;
  offer: PayOffer | null;
}

export function offerOf(s: FlowState, env: Env): PayOffer | null {
  const offer = env.offer;
  return offer && s.offerId === offer.id && s.tier === 'solo' && !isGift(s) ? offer : null;
}

export function offerPlans(offer: PayOffer | null, plans: Plan[]): Plan[] {
  if (!offer) return plans;
  return plans
    .filter((p) => p.id === offer.plan_id)
    .map((p) => ({ ...p, price: offer.price, savings_pct: 0 }));
}

export function offerMethods(offer: PayOffer | null, methods: PayMethod[]): PayMethod[] {
  if (!offer?.requires_bind) return methods;
  return methods.filter((m) => m.bind && m.renew_plans.includes(offer.plan_id));
}

export function planListOf(s: FlowState, env: Env): Plan[] {
  return offerPlans(offerOf(s, env), tierPlans(s.tier, env.data?.plans ?? [], env.data?.shared));
}

function bestOf(plans: Plan[]): string | null {
  let best: Plan | null = null;
  for (const p of plans) if (!best || p.savings_pct > best.savings_pct) best = p;
  return best?.id ?? null;
}

export function planIdOf(s: FlowState, env: Env): string | null {
  const offer = offerOf(s, env);
  if (offer) return offer.plan_id;
  return s.planId ?? bestOf(tierPlans(s.tier, env.data?.plans ?? [], env.data?.shared));
}

export function selectedPlanOf(s: FlowState, env: Env): Plan | null {
  const id = planIdOf(s, env);
  return planListOf(s, env).find((p) => p.id === id) ?? null;
}

export function ctxOf(s: FlowState, env: Env): RouteContext {
  return { planId: planIdOf(s, env), gift: isGift(s), shared: s.tier !== 'solo' };
}

export function allMethodsOf(env: Env): PayMethod[] {
  return env.data ? payMethods(env.data) : [];
}

export function optionsOf(s: FlowState, env: Env): PayMethod[] {
  const ctx = ctxOf(s, env);
  return offerMethods(
    offerOf(s, env),
    allMethodsOf(env).filter((m) => usable(m, ctx)),
  );
}

export function pickedOf(s: FlowState, env: Env): PayMethod | null {
  if (!s.methodId) return null;
  return optionsOf(s, env).find((m) => m.id === s.methodId) ?? null;
}

export function routeOf(s: FlowState, env: Env): Route | null {
  const picked = pickedOf(s, env);
  if (!picked) return null;
  const forced = offerOf(s, env)?.requires_bind === true;
  return chooseRoute(picked, forced ? true : s.renewPref, ctxOf(s, env));
}

export function currencyIn(s: FlowState, env: Env): Currency {
  const route = routeOf(s, env);
  return route ? currencyOf(route) : (offerOf(s, env)?.currency ?? 'RUB');
}

export function amountOf(s: FlowState, env: Env): string {
  const plan = selectedPlanOf(s, env);
  return plan ? planPrice(plan, currencyIn(s, env)) : '';
}

export function viaBindOf(s: FlowState, env: Env): boolean {
  const route = routeOf(s, env);
  return route?.viaBind === true && !!route.method.bind;
}

export function canOnceOf(s: FlowState, env: Env): boolean {
  const picked = pickedOf(s, env);
  return !!picked && hasOnce(picked) && offerOf(s, env)?.requires_bind !== true;
}

export function renewAvailableOf(s: FlowState, env: Env): boolean {
  const picked = pickedOf(s, env);
  return !!picked && renewable(picked, ctxOf(s, env)) && offerOf(s, env)?.requires_bind !== true;
}

export function periodDaysOf(s: FlowState, env: Env): number {
  return pickedOf(s, env)?.period_days ?? selectedPlanOf(s, env)?.period_days ?? 30;
}
