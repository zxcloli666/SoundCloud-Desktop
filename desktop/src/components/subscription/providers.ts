import type {
  BoostyMethod,
  CheckoutReq,
  MethodRoutes,
  PayRoute,
  PlansResponse,
  RenewRoute,
  RouteMethod,
} from '../../lib/pay-client';

export type ActivationKind =
  | 'sbp'
  | 'card_ru'
  | 'card_intl'
  | 'crypto_platega'
  | 'crypto_bot'
  | 'tgstars';

export interface ActivationOption {
  kind: ActivationKind;
  method: RouteMethod;
  once: PayRoute | null;
  renew: RenewRoute | null;
  /** i18n suffix under starpass.method.* */
  i18n: string;
  /** mono tag, e.g. "TON / USDT" */
  tag: string;
}

export interface RouteContext {
  planId: string | null;
  gift: boolean;
  shared: boolean;
  cardSupported: boolean;
}

export interface ChosenRoute {
  route: PayRoute;
  recurring: boolean;
}

const ORDER: RouteMethod[] = ['sbp', 'card_ru', 'card_intl', 'crypto', 'stars'];

const I18N: Record<ActivationKind, string> = {
  sbp: 'sbp',
  card_ru: 'cardRu',
  card_intl: 'cardIntl',
  crypto_platega: 'cryptoPlatega',
  crypto_bot: 'cryptoBot',
  tgstars: 'tgStars',
};

const TAGS: Record<ActivationKind, string> = {
  sbp: 'NSPK',
  card_ru: '3-D SECURE',
  card_intl: 'USD',
  crypto_platega: 'ON-CHAIN',
  crypto_bot: '@CryptoBot',
  tgstars: '★',
};

function kindOf({ method, once }: MethodRoutes): ActivationKind {
  if (method === 'crypto') return once?.provider === 'cryptobot' ? 'crypto_bot' : 'crypto_platega';
  return method === 'stars' ? 'tgstars' : method;
}

export function activationOptions(plans: PlansResponse): ActivationOption[] {
  const routes = plans.routes ?? [];
  return ORDER.flatMap((method) => {
    const found = routes.find((r) => r.method === method);
    if (!found || (!found.once && !found.renew)) return [];
    const kind = kindOf(found);
    return [{ ...found, kind, i18n: I18N[kind], tag: TAGS[kind] }];
  });
}

export type Currency = 'RUB' | 'USD';

export function bindOf(route: PayRoute): BoostyMethod | null {
  if (route.provider !== 'boostycard') return null;
  if (route.method === 'sbp' || route.method === 'card_usd') return route.method;
  return 'card';
}

export function currencyOf(route: PayRoute | null | undefined): Currency {
  return route?.method === 'card_usd' ? 'USD' : 'RUB';
}

export function renewFor(opt: ActivationOption, ctx: RouteContext): RenewRoute | null {
  const renew = opt.renew;
  if (!renew || !ctx.planId || ctx.gift || !renew.plans.includes(ctx.planId)) return null;
  const bind = bindOf(renew);
  if (bind && ctx.shared) return null;
  if (bind && bind !== 'sbp' && !ctx.cardSupported) return null;
  return renew;
}

export function usable(opt: ActivationOption, ctx: RouteContext): boolean {
  return !!opt.once || !!renewFor(opt, ctx);
}

export function chooseRoute(
  opt: ActivationOption,
  renewOn: boolean,
  ctx: RouteContext,
): ChosenRoute | null {
  const renew = renewFor(opt, ctx);
  if (renew && (renewOn || !opt.once)) return { route: renew, recurring: true };
  return opt.once ? { route: opt.once, recurring: false } : null;
}

export function toCheckout({ route, recurring }: ChosenRoute, planId: string): CheckoutReq {
  return { plan_id: planId, provider: route.provider, method: route.method, recurring };
}
