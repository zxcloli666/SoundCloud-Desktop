import { cardNative } from '../../../../lib/card-link/native';
import {
  type Binds,
  type Order,
  type OrderAction,
  type PayOffer,
  type PaySubscription,
  type PlansResponse,
  payApi,
  type RunnerBundle,
  type SharedOverview,
} from '../../../../lib/pay-client';
import { setIsPremium } from '../../../../lib/premium-cache';
import { queryClient } from '../../../../lib/query-client';
import { userUrn } from '../../../../lib/star-shared';
import { useStarMoments } from '../../../../stores/star-moments';
import { sleep, waitUntil } from '../steps';
import type { LabKit, LabScene } from '../types';

const DAY = 86_400;
const now = () => Math.floor(Date.now() / 1000);
const BUNDLE = { contract: 2 } as RunnerBundle;

const plan = (id: string, months: number, rub: number, usd: number, save: number) => ({
  id,
  months,
  period_days: months * 30,
  savings_pct: save,
  price: { RUB: rub, USD: usd, XTR: Math.round(rub * 0.6) },
});

const PLANS: PlansResponse = {
  api: 2,
  plans: [plan('m1', 1, 100, 199, 0), plan('m3', 3, 270, 499, 10), plan('m12', 12, 960, 1799, 20)],
  shared: [
    {
      tier: 'duo',
      seats: 1,
      plans: [
        plan('m1', 1, 160, 299, 0),
        plan('m3', 3, 430, 799, 10),
        plan('m12', 12, 1500, 2799, 20),
      ],
    },
    {
      tier: 'family',
      seats: 4,
      plans: [
        plan('m1', 1, 300, 549, 0),
        plan('m3', 3, 810, 1499, 10),
        plan('m12', 12, 2800, 5199, 20),
      ],
    },
  ],
  methods: [
    {
      id: 'sbp',
      tag: 'ru',
      currency: 'RUB',
      flow: 'qr',
      bind: { flow: 'qr', currency: 'RUB' },
      renew_plans: ['m1'],
      period_days: 30,
      gift: true,
      shared: true,
    },
    {
      id: 'card_ru',
      tag: 'ru',
      currency: 'RUB',
      flow: 'charge',
      bind: { flow: 'card_form', currency: 'RUB' },
      renew_plans: ['m1', 'm3', 'm12'],
      period_days: null,
      gift: true,
      shared: true,
    },
    {
      id: 'card_intl',
      tag: 'world',
      currency: 'USD',
      flow: 'charge',
      bind: { flow: 'card_form', currency: 'USD' },
      renew_plans: ['m1', 'm3', 'm12'],
      period_days: null,
      gift: false,
      shared: false,
    },
    {
      id: 'crypto',
      tag: 'world',
      currency: 'USD',
      flow: 'open',
      bind: null,
      renew_plans: [],
      period_days: null,
      gift: true,
      shared: true,
    },
    {
      id: 'stars',
      tag: 'world',
      currency: 'XTR',
      flow: 'open',
      bind: null,
      renew_plans: [],
      period_days: null,
      gift: true,
      shared: true,
    },
  ],
};

const TRIAL = {
  available: true,
  days: 3,
  methods: ['card_ru' as const, 'sbp' as const],
  reason: null,
  active: null,
};

const FREE: PaySubscription = {
  api: 2,
  premium: false,
  premium_until: 0,
  star_since: null,
  last_ended_at: null,
  sources: [],
  renewal: null,
  trial: TRIAL,
  discord: null,
};

function member(patch: Partial<PaySubscription> = {}): PaySubscription {
  const until = now() + 9 * DAY;
  return {
    ...FREE,
    premium: true,
    premium_until: until,
    star_since: now() - 200 * DAY,
    sources: [{ category: 'paid', ends_at: until, renews: false }],
    renewal: {
      at: until,
      amount_minor: 100,
      currency: 'RUB',
      period_days: 30,
      method: 'card_ru',
      trial: false,
      relink: false,
      needs_confirm: false,
    },
    trial: { ...TRIAL, available: false },
    discord: {
      discord_id: '1',
      linked_at: 0,
      updated_at: 0,
      username: 'astolfo',
      global_name: 'Астольфо',
      avatar_url: null,
      is_booster: true,
      has_star_role: true,
    },
    ...patch,
  };
}

function binds(states: Partial<Record<string, Binds['methods'][number]['state']>>): Binds {
  return {
    api: 2,
    methods: (['sbp', 'card_ru', 'card_intl'] as const).map((method) => ({
      method,
      state: states[method] ?? 'none',
      can_link: true,
      flow: method === 'sbp' ? 'qr' : 'card_form',
    })),
  };
}

function order(action: OrderAction | null, patch: Partial<Order> = {}): Order {
  return {
    api: 2,
    order_id: 'lab-order-1',
    status: 'pending',
    reason: null,
    method: 'card_ru',
    plan_id: 'm12',
    tier: 'solo',
    amount_minor: 960,
    currency: 'RUB',
    recurring: true,
    gift: false,
    gift_code: null,
    expires_at: now() + 14 * 60,
    paid_at: null,
    granted_at: null,
    premium_until: now() + 365 * DAY,
    action,
    ...patch,
  };
}

const NO_SHARED: SharedOverview = { role: 'none', owner: null, member_of: null };

const OWNER: SharedOverview = {
  role: 'owner',
  owner: {
    tier: 'family',
    seats: 4,
    ends_at: now() + 40 * DAY,
    invite_code: 'JOIN-7KQ2-MX4P-L9TA',
    members: [
      { sc_user_id: '101', seat: 1, joined_at: now() - 30 * DAY, removable_at: 0 },
      { sc_user_id: '102', seat: 2, joined_at: now() - 3 * DAY, removable_at: now() + 4 * DAY },
    ],
  },
  member_of: null,
};

const MEMBER: SharedOverview = {
  role: 'member',
  owner: null,
  member_of: { owner_sc_user_id: '101', tier: 'duo', ends_at: now() + 21 * DAY },
};

function offer(patch: Partial<PayOffer> = {}): PayOffer {
  return {
    id: 'lab-offer',
    plan_id: 'm1',
    price: { RUB: 50, USD: 99 },
    list_price: { RUB: 100, USD: 199 },
    currency: 'RUB',
    requires_bind: false,
    grant_days: 30,
    renews_at_price: { RUB: 100, USD: 199 },
    ends_at: now() + 5 * 3600,
    proof: { plays: 214, days: 30 },
    ...patch,
  };
}

interface World {
  sub: PaySubscription;
  bound?: Binds;
  placed?: Order | null;
  shared?: SharedOverview;
  personal?: PayOffer | null;
}

function world({
  sub,
  bound = binds({}),
  placed = null,
  shared = NO_SHARED,
  personal = null,
}: World) {
  setIsPremium(sub.premium);
  seedPeople();
  useStarMoments.setState({ seen: ['tenure:1', 'tenure:2', 'tenure:3'] });
  payApi.plans = async () => PLANS;
  payApi.subscription = async () => sub;
  payApi.binds = async () => bound;
  payApi.shared = async () => shared;
  payApi.sharedPreview = async (tier) => ({
    tier,
    from_personal_days: 9,
    from_plan_days: 365,
    carry_days: 9,
    ends_at: now() + 374 * DAY,
  });
  payApi.gifts = async () => ({
    gifts: [
      gift('g1', 'STAR-8F2K-Q7LM-3XPA-W9DE', 30, false),
      gift('g2', 'STAR-2HJD-K8NB-5VCQ-T4RE', 365, false),
      gift('g3', 'STAR-6PLW-Y3MX-9QAZ-B7KU', 90, true),
    ],
  });
  payApi.referral = async () => ({
    code: 'ASTOLFO7',
    invited: 3,
    days_earned: 21,
    bonus_days: 7,
    cap: 10,
  });
  payApi.offer = async () => ({ api: 2, offer: personal });
  payApi.offerShown = async () => ({ api: 2, offer: personal });
  payApi.bindCancel = async () => bound;
  payApi.bindStep = async (id) => ({
    api: 2,
    session_id: id,
    state: 'pending',
    reason: null,
    qr: null,
    page_url: null,
    trial: null,
    trial_refused: null,
  });
  if (placed) {
    payApi.checkout = async () => placed;
    payApi.order = async () => placed;
  }
}

function gift(id: string, code: string, days: number, redeemed: boolean) {
  return {
    order_id: id,
    plan_id: days >= 360 ? 'm12' : days >= 90 ? 'm3' : 'm1',
    period_days: days,
    code,
    created_at: now() - DAY,
    redeemed,
    redeemed_at: redeemed ? now() : null,
  };
}

function withState(usr: Record<string, string>) {
  window.history.replaceState({ usr, key: 'lab', idx: 0 }, '', window.location.href);
}

function seedPeople() {
  for (const [id, username] of [
    ['101', 'mira'],
    ['102', 'sasha'],
  ]) {
    queryClient.setQueryData(['user', userUrn(id)], {
      urn: userUrn(id),
      username,
      avatar_url: null,
    });
  }
}

async function press(selector: string) {
  await waitUntil(() => document.querySelector(selector) !== null);
  document.querySelector<HTMLElement>(selector)?.click();
  await sleep(350);
}

async function pick(method: string) {
  await press(`[data-method="${method}"]`);
  await waitUntil(
    () => document.querySelector(`[data-method="${method}"][aria-pressed="true"]`) !== null,
  );
}

async function renewOn() {
  await press('[data-ui="star-renew"] [role="switch"][aria-checked="false"]');
}

async function pay() {
  await waitUntil(
    () => !document.querySelector<HTMLButtonElement>('[data-star-act="pay"]')?.disabled,
  );
  await press('[data-star-act="pay"]');
  await sleep(700);
}

function cardForm() {
  cardNative.open = async () => 'card_form';
  cardNative.abort = async () => {};
  cardNative.close = async () => {};
  payApi.bindStart = async (method) => ({
    api: 2,
    state: 'open',
    session_id: 1,
    method,
    flow: 'card_form',
    expires_at: now() + 600,
    qr: null,
    runner: { bundle: BUNDLE, params: {} },
  });
}

function sbpLink() {
  payApi.bindStart = async (method) => ({
    api: 2,
    state: 'open',
    session_id: 2,
    method,
    flow: 'qr',
    expires_at: now() + 9 * 60 + 41,
    qr: { uri: 'https://qr.nspk.ru/lab-bind-1', png: '' },
    runner: null,
  });
}

function confirm(closed: boolean) {
  cardNative.open = async () => 'confirm';
  cardNative.page = () =>
    closed ? Promise.resolve({ end: 'closed' } as never) : new Promise(() => {});
  cardNative.close = async () => {};
}

type Setup = (kit: LabKit) => void;

const STATES: { id: string; title: string; setup: Setup }[] = [
  {
    id: 'buy',
    title: 'not subscribed',
    setup: (kit) => {
      kit.star(false);
      world({ sub: FREE });
    },
  },
  {
    id: 'buy-gift',
    title: 'gift for a friend',
    setup: (kit) => {
      kit.star(false);
      world({ sub: FREE });
      kit.after(() => press('[data-recipient="gift"]'));
    },
  },
  ...(['sbp', 'card_ru', 'card_intl', 'crypto', 'stars'] as const).map((method) => ({
    id: `checkout-${method}`,
    title: `checkout, ${method}`,
    setup: (kit: LabKit) => {
      kit.star(false);
      world({ sub: FREE, bound: binds({ card_ru: 'linked' }) });
      kit.after(() => pick(method));
    },
  })),
  {
    id: 'duo',
    title: 'Family checkout with carry-over',
    setup: (kit) => {
      kit.star(false);
      world({ sub: FREE });
      kit.after(async () => {
        await press('[data-tier="family"]');
        await pick('sbp');
      });
    },
  },
  {
    id: 'card',
    title: 'card form',
    setup: (kit) => {
      kit.star(false);
      world({ sub: FREE });
      cardForm();
      kit.after(async () => {
        await pick('card_ru');
        await pay();
      });
    },
  },
  {
    id: 'sbp-link',
    title: 'SBP link with auto-renew',
    setup: (kit) => {
      kit.star(false);
      world({ sub: FREE });
      sbpLink();
      kit.after(async () => {
        await press('[data-plan="m1"]');
        await pick('sbp');
        await renewOn();
        await pay();
        await sleep(400);
      });
    },
  },
  {
    id: 'pay-qr',
    title: 'pay, SBP QR',
    setup: (kit) => {
      kit.star(false);
      world({
        sub: FREE,
        placed: order(
          { type: 'qr', qr: 'https://qr.nspk.ru/lab-order-1', url: null },
          { method: 'sbp' },
        ),
      });
      kit.after(async () => {
        await pick('sbp');
        await pay();
      });
    },
  },
  {
    id: 'pay-open',
    title: 'pay, crypto page',
    setup: (kit) => {
      kit.star(false);
      world({
        sub: FREE,
        placed: order(
          { type: 'open', url: 'https://pay.lab/crypto', alt: [] },
          { method: 'crypto', currency: 'USD' },
        ),
      });
      kit.after(async () => {
        await pick('crypto');
        await pay();
      });
    },
  },
  {
    id: 'confirm',
    title: 'pay, bank 3DS open',
    setup: (kit) => {
      kit.star(false);
      confirm(false);
      world({
        sub: FREE,
        bound: binds({ card_ru: 'linked' }),
        placed: order({ type: 'confirm', url: 'https://bank.lab/3ds', bundle: BUNDLE }),
      });
      kit.after(async () => {
        await pick('card_ru');
        await pay();
      });
    },
  },
  {
    id: 'confirm-closed',
    title: 'pay, bank 3DS closed early',
    setup: (kit) => {
      kit.star(false);
      confirm(true);
      world({
        sub: FREE,
        bound: binds({ card_ru: 'linked' }),
        placed: order({ type: 'confirm', url: 'https://bank.lab/3ds', bundle: BUNDLE }),
      });
      kit.after(async () => {
        await pick('card_ru');
        await pay();
      });
    },
  },
  {
    id: 'failed',
    title: 'pay failed, relink',
    setup: (kit) => {
      kit.star(false);
      world({
        sub: FREE,
        bound: binds({ card_ru: 'linked' }),
        placed: order(null, { status: 'failed', reason: 'relink' }),
      });
      kit.after(async () => {
        await pick('card_ru');
        await pay();
      });
    },
  },
  {
    id: 'success',
    title: 'paid',
    setup: (kit) => {
      kit.star(false);
      world({
        sub: FREE,
        bound: binds({ card_ru: 'linked' }),
        placed: order(null, { status: 'granted' }),
      });
      kit.after(async () => {
        await pick('card_ru');
        await pay();
      });
    },
  },
  {
    id: 'success-gift',
    title: 'gift paid',
    setup: (kit) => {
      kit.star(false);
      world({
        sub: FREE,
        placed: order(null, {
          status: 'granted',
          gift: true,
          gift_code: 'STAR-8F2K-Q7LM-3XPA-W9DE',
          method: 'sbp',
        }),
      });
      kit.after(async () => {
        await press('[data-recipient="gift"]');
        await pick('sbp');
        await pay();
      });
    },
  },
  {
    id: 'trial',
    title: 'free trial',
    setup: (kit) => {
      kit.star(false);
      world({ sub: FREE });
      kit.after(() => press('[data-star-act="trial"]'));
    },
  },
  {
    id: 'trial-used',
    title: 'free trial refused',
    setup: (kit) => {
      kit.star(false);
      withState({ intent: 'trial' });
      world({ sub: { ...FREE, trial: { ...TRIAL, available: false, reason: 'device_used' } } });
    },
  },
  {
    id: 'manage',
    title: 'manage, renews, relink and link rows',
    setup: (kit) => {
      kit.star(true);
      world({ sub: member(), bound: binds({ card_ru: 'linked', card_intl: 'rebind' }) });
    },
  },
  {
    id: 'manage-confirm',
    title: 'manage, bank asks to confirm',
    setup: (kit) => {
      kit.star(true);
      const sub = member();
      world({
        sub: { ...sub, renewal: sub.renewal && { ...sub.renewal, needs_confirm: true } },
        bound: binds({ card_ru: 'linked' }),
      });
    },
  },
  {
    id: 'manage-relink',
    title: 'manage, renewal needs relink',
    setup: (kit) => {
      kit.star(true);
      const sub = member();
      world({
        sub: { ...sub, renewal: sub.renewal && { ...sub.renewal, relink: true } },
        bound: binds({ card_ru: 'rebind' }),
      });
    },
  },
  {
    id: 'manage-ending',
    title: 'manage, ends in 2 days',
    setup: (kit) => {
      kit.star(true);
      const until = now() + 2 * DAY;
      world({
        sub: member({
          premium_until: until,
          renewal: null,
          discord: null,
          sources: [{ category: 'paid', ends_at: until, renews: false }],
        }),
      });
    },
  },
  {
    id: 'manage-trial',
    title: 'manage, trial running, cancel asked',
    setup: (kit) => {
      kit.star(true);
      const until = now() + 2 * DAY;
      const sub = member();
      world({
        sub: {
          ...sub,
          sources: [{ category: 'trial', ends_at: until, renews: false }],
          renewal: sub.renewal && { ...sub.renewal, at: until, trial: true },
          trial: { ...TRIAL, available: false, active: { method: 'card_ru', ends_at: until } },
        } as PaySubscription,
        bound: binds({ card_ru: 'linked' }),
      });
      kit.after(() => press('[data-ui="star-trial-row"] button:last-child'));
    },
  },
  {
    id: 'owner',
    title: 'manage, Family owner',
    setup: (kit) => {
      kit.star(true);
      world({ sub: member(), bound: binds({ card_ru: 'linked' }), shared: OWNER });
    },
  },
  {
    id: 'plan',
    title: 'Family seats',
    setup: (kit) => {
      kit.star(true);
      world({ sub: member(), bound: binds({ card_ru: 'linked' }), shared: OWNER });
      kit.after(() => press('[data-ui="star-seats"]'));
    },
  },
  {
    id: 'member',
    title: 'manage, member of a Duo',
    setup: (kit) => {
      kit.star(true);
      world({
        sub: member({
          renewal: null,
          premium_until: now() + 21 * DAY,
          sources: [{ category: 'shared', ends_at: now() + 21 * DAY, renews: false }],
        }),
        shared: MEMBER,
      });
    },
  },
  {
    id: 'gifts',
    title: 'my gifts',
    setup: (kit) => {
      kit.star(true);
      world({ sub: member(), bound: binds({ card_ru: 'linked' }) });
      kit.after(() => press('[data-star-act="gifts"]'));
    },
  },
  {
    id: 'invite',
    title: 'invite a friend',
    setup: (kit) => {
      kit.star(true);
      world({ sub: member(), bound: binds({ card_ru: 'linked' }) });
      kit.after(() => press('[data-star-act="invite"]'));
    },
  },
  {
    id: 'redeem',
    title: 'redeem a code',
    setup: (kit) => {
      kit.star(false);
      world({ sub: FREE });
      kit.after(() => press('[data-star-act="redeem"]'));
    },
  },
  {
    id: 'offer',
    title: 'personal offer, plain',
    setup: (kit) => {
      kit.star(false);
      withState({ offer: 'lab-offer' });
      world({ sub: FREE, personal: offer() });
      kit.after(() => pick('sbp'));
    },
  },
  {
    id: 'offer-bind',
    title: 'personal offer in USD, needs a link',
    setup: (kit) => {
      kit.star(false);
      withState({ offer: 'lab-offer' });
      world({
        sub: FREE,
        personal: offer({ requires_bind: true, currency: 'USD', ends_at: now() + 40 * 3600 }),
      });
      kit.after(() => pick('card_intl'));
    },
  },
];

export const scenes: LabScene[] = STATES.map(({ id, title, setup }) => ({
  id: `star-${id}`,
  title: `STAR: ${title}`,
  route: '/star',
  setup,
}));
