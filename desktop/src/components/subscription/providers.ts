import type {
  CheckoutReq,
  PlansResponse,
  PlategaMethod,
  ProviderId,
  RecurringRule,
} from '../../lib/pay-client';

// A user-facing "activation method" flattens the pay backend's
// provider × method matrix into the five concrete options the concept shows.
export type ActivationKind =
  | 'sbp'
  | 'card_ru'
  | 'card_intl'
  | 'crypto_platega'
  | 'crypto_bot'
  | 'tgstars';

export interface ActivationOption {
  kind: ActivationKind;
  provider: ProviderId;
  method?: PlategaMethod;
  /** i18n suffix under starpass.method.* */
  i18n: string;
  /** mono tag, e.g. "TON / USDT" */
  tag: string;
}

const ORDER: Omit<ActivationOption, 'tag'>[] = [
  { kind: 'sbp', provider: 'platega', method: 'sbp', i18n: 'sbp' },
  { kind: 'card_ru', provider: 'platega', method: 'card_ru', i18n: 'cardRu' },
  {
    kind: 'card_intl',
    provider: 'platega',
    method: 'card_intl',
    i18n: 'cardIntl',
  },
  // Two crypto rails: Platega = pay in crypto on-chain (crypto as crypto);
  // CryptoBot = a hot wallet for users who already hold a balance in the bot.
  {
    kind: 'crypto_platega',
    provider: 'platega',
    method: 'crypto',
    i18n: 'cryptoPlatega',
  },
  { kind: 'crypto_bot', provider: 'cryptobot', i18n: 'cryptoBot' },
  { kind: 'tgstars', provider: 'tgstars', i18n: 'tgStars' },
];

const TAGS: Record<ActivationKind, string> = {
  sbp: 'NSPK',
  card_ru: '3-D SECURE',
  card_intl: 'USD / EUR',
  crypto_platega: 'ON-CHAIN',
  crypto_bot: '@CryptoBot',
  tgstars: '★',
};

/** Build the available activation options from a plans() response. */
export function activationOptions(plans: PlansResponse): ActivationOption[] {
  const plategaMethods = new Set<PlategaMethod>(plans.methods.platega);
  return ORDER.filter((o) => {
    if (!plans.providers[o.provider]) return false;
    if (o.provider === 'platega' && o.method) return plategaMethods.has(o.method);
    return true;
  }).map((o) => ({ ...o, tag: TAGS[o.kind] }));
}

export function recurringRule(
  rules: RecurringRule[] | undefined,
  opt: ActivationOption | null,
  planId: string | null,
): RecurringRule | null {
  if (!rules || !opt || !planId) return null;
  return (
    rules.find(
      (rule) =>
        rule.provider === opt.provider &&
        (!rule.method || rule.method === opt.method) &&
        rule.plans.includes(planId),
    ) ?? null
  );
}

/** Map an activation option + plan into a checkout request body. */
export function toCheckout(
  opt: ActivationOption,
  planId: string,
  recurring?: boolean,
): CheckoutReq {
  return {
    plan_id: planId,
    provider: opt.provider,
    method: opt.method,
    recurring,
  };
}
