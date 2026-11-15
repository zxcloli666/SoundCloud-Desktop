import type { Currency, MethodId, PayMethod, PlansResponse } from '../../lib/pay-client';

export interface MethodTile {
  kind: MethodId;
  i18n: string;
  tag: string;
}

export interface RouteContext {
  planId: string | null;
  gift: boolean;
  shared: boolean;
}

export interface Route {
  method: PayMethod;
  recurring: boolean;
  viaBind: boolean;
}

const ORDER: MethodId[] = ['sbp', 'card_ru', 'card_intl', 'crypto', 'stars'];

const I18N: Record<MethodId, string> = {
  sbp: 'sbp',
  card_ru: 'cardRu',
  card_intl: 'cardIntl',
  crypto: 'crypto',
  stars: 'tgStars',
};

const TAGS: Record<MethodId, string> = {
  sbp: 'NSPK',
  card_ru: '3-D SECURE',
  card_intl: 'USD',
  crypto: 'ON-CHAIN',
  stars: '★',
};

export function tileOf(kind: MethodId): MethodTile {
  return { kind, i18n: I18N[kind], tag: TAGS[kind] };
}

export function payMethods(plans: PlansResponse): PayMethod[] {
  return ORDER.flatMap((id) => plans.methods.filter((m) => m.id === id));
}

export function hasOnce(m: PayMethod): boolean {
  return m.flow !== 'charge';
}

export function renewable(m: PayMethod, ctx: RouteContext): boolean {
  if (!ctx.planId || ctx.gift || !m.renew_plans.includes(ctx.planId)) return false;
  return !(ctx.shared && m.bind);
}

export function usable(m: PayMethod, ctx: RouteContext): boolean {
  if (ctx.gift && !m.gift) return false;
  if (ctx.shared && !m.shared) return false;
  return hasOnce(m) || !!m.bind;
}

export function chooseRoute(m: PayMethod, renewOn: boolean | null, ctx: RouteContext): Route {
  const recurring = renewable(m, ctx) && (renewOn ?? !hasOnce(m));
  return { method: m, recurring, viaBind: !!m.bind && (recurring || !hasOnce(m)) };
}

export function currencyOf(route: Route | null): Currency {
  if (!route) return 'RUB';
  return route.viaBind && route.method.bind ? route.method.bind.currency : route.method.currency;
}
