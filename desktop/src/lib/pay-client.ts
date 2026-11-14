// Client for the STAR payment backend (pay). Separate from the catalog `api()`
// host-routing client: pay is its own service, authed with the same x-session-id
// (pay resolves it against the backend — the client never asserts a user id).

// Native HTTP (from Rust), same as the catalog api-client — bypasses the webview's
// CORS preflight and the scproxy asset router (browser fetch to pay 403'd on both).
import { getSessionId } from './api-client';
import { PAY_BASE } from './constants';
import { trackedInvoke as invoke } from './diagnostics';
import { edgeFetch } from './edge';

export class PayError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`pay ${status}: ${body}`);
    this.name = 'PayError';
  }
}

// The session token is owned by Rust (auth_session.json). Prefer the in-memory
// mirror, but fall back to asking Rust directly — pay must never miss the session
// just because the JS mirror wasn't seeded in this module/timing.
async function sessionToken(): Promise<string | null> {
  const sid = getSessionId();
  if (sid && sid !== 'undefined' && sid !== 'null') return sid;
  try {
    const s = await invoke<{ token: string | null }>('auth_status');
    return s?.token ?? null;
  } catch {
    return null;
  }
}

async function payRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const sid = await sessionToken();
  if (sid) headers.set('x-session-id', sid);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  const res = await edgeFetch(`${PAY_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new PayError(res.status, text);
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export type ProviderId = 'platega' | 'cryptobot' | 'tgstars' | 'boostycard';
export type PlategaMethod = 'sbp' | 'card_ru' | 'card_intl' | 'crypto';

export interface Plan {
  id: string;
  months: number;
  period_days: number;
  price_rub: number;
  price_usd_cents?: number;
  savings_pct: number;
  stars: number;
}

export type SharedTierId = 'duo' | 'family';
export type TierId = 'solo' | SharedTierId;

export interface SharedTier {
  tier: SharedTierId;
  /** Members besides the owner. */
  seats: number;
  monthly_rub: number;
  plans: Plan[];
}

export type RouteMethod = 'sbp' | 'card_ru' | 'card_intl' | 'crypto' | 'stars';

export interface PayRoute {
  provider: ProviderId;
  method: string;
}

export interface RenewRoute extends PayRoute {
  plans: string[];
  period_days: number;
}

export interface MethodRoutes {
  method: RouteMethod;
  once: PayRoute | null;
  renew: RenewRoute | null;
}

export interface PlansResponse {
  monthly_rub: number;
  plans: Plan[];
  shared?: SharedTier[];
  providers: Partial<Record<ProviderId, boolean>>;
  methods: { platega: PlategaMethod[] };
  routes?: MethodRoutes[];
}

export interface CheckoutReq {
  plan_id: string;
  provider: ProviderId;
  method?: string;
  recurring?: boolean;
  gift?: boolean;
  tier?: SharedTierId;
  ref?: string;
}

export type PayTargetKind = 'tg' | 'webapp' | 'miniapp';

export interface PayTarget {
  kind: PayTargetKind;
  url: string;
}

export interface CheckoutResp {
  order_id: string;
  provider: string;
  status: string;
  currency: string;
  amount_rub: number;
  amount_minor: number;
  recurring: boolean;
  pay_url?: string | null;
  /** Alternative open targets (CryptoBot: Telegram / web / mini app). */
  pay_targets?: PayTarget[];
  sbp_qr?: string | null;
  expires_at: number;
}

export interface OrderStatus {
  order_id: string;
  status: 'pending' | 'paid' | 'granted' | 'failed' | 'expired' | 'refunded';
  provider: string;
  currency: string;
  amount_rub: number;
  amount_minor: number | null;
  pay_url?: string | null;
  sbp_qr?: string | null;
  paid_at?: number | null;
  granted_at?: number | null;
  expires_at?: number | null;
  premium_until: number;
  gift?: boolean;
  gift_code?: string | null;
}

export interface Entitlement {
  source: string;
  ends_at: number;
  recurring: boolean;
  auto_renew: boolean;
  canceled: boolean;
}

export interface Renewal {
  source: string;
  at: number;
  amount: number;
  currency: string;
  period_days: number;
}

export interface DiscordLink {
  discord_id: string;
  username: string | null;
  global_name: string | null;
  avatar_url: string | null;
  is_booster: boolean;
  has_star_role: boolean;
  linked_at: number;
  updated_at: number;
}

export interface PaySubscription {
  premium: boolean;
  premium_until: number;
  star_since?: number | null;
  entitlements: Entitlement[];
  renewal?: Renewal | null;
  /** Mirror of the user's linked Discord (bot-owned). Null if not linked. */
  discord: DiscordLink | null;
  /** When the latest STAR of any source ended; null if never had one. */
  last_ended_at?: number | null;
  trial_available?: boolean;
}

export interface Gift {
  order_id: string;
  plan_id: string;
  period_days: number;
  code: string;
  created_at: number;
  redeemed: boolean;
  redeemed_at: number | null;
}

export interface Referral {
  code: string;
  invited: number;
  days_earned: number;
  bonus_days: number;
  cap: number;
}

export interface RedeemResp {
  ok: boolean;
  plan_id: string;
  period_days: number;
  premium_until: number;
}

export interface SharedMember {
  sc_user_id: string;
  seat: number;
  joined_at: number;
  /** Unix seconds from which the owner may remove this member again. */
  removable_at: number;
}

export interface SharedOwner {
  tier: SharedTierId;
  seats: number;
  ends_at: number;
  invite_code: string;
  members: SharedMember[];
}

export interface SharedMembership {
  owner_sc_user_id: string;
  tier: SharedTierId;
  ends_at: number;
}

export interface SharedOverview {
  role: 'none' | 'owner' | 'member';
  owner: SharedOwner | null;
  member_of: SharedMembership | null;
}

export interface SharedPreview {
  tier: SharedTierId;
  from_personal_days: number;
  from_plan_days: number;
  carry_days: number;
  ends_at: number;
}

export interface BoostyBundle {
  serial: number;
  not_after: number;
  kid: string;
  entry: string;
  allowed_hosts: string[];
  script: string;
  sig: string;
}

export interface BoostySgParams {
  provider: string;
  payment_id: string | number;
  public_token: string;
  widget_name: string | null;
}

export interface BoostyYunoParams {
  provider: 'yuno';
  public_api_key: string;
  checkout_session: string;
}

export type BoostyParams = BoostySgParams | BoostyYunoParams;

export type BoostyCardMethod = 'card' | 'card_usd';
export type BoostyMethod = BoostyCardMethod | 'sbp';

export interface BoostyQr {
  uri: string;
  png: string;
}

export interface BoostyCardStart {
  session_id: number;
  method: BoostyCardMethod;
  expires_at: number;
  bundle: BoostyBundle;
  params: BoostyParams;
}

export interface BoostySbpStart {
  session_id: number;
  method: 'sbp';
  expires_at: number;
  qr?: BoostyQr;
}

export type BoostyStepStatus = 'pending' | 'bound' | 'expired' | 'failed';

export interface BoostyStep {
  status: BoostyStepStatus;
  reason?: string;
  qr?: BoostyQr;
  url?: string;
}

export interface BoostyBinds {
  bound: boolean;
  binds: Record<BoostyMethod, boolean>;
  rebind?: Partial<Record<BoostyMethod, boolean>>;
}

const boostyPost = <T>(path: string, body?: object) =>
  payRequest<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

export const payApi = {
  plans: () => payRequest<PlansResponse>('/api/plans'),
  checkout: (req: CheckoutReq) =>
    payRequest<CheckoutResp>('/api/checkout', { method: 'POST', body: JSON.stringify(req) }),
  order: (id: string) => payRequest<OrderStatus>(`/api/orders/${encodeURIComponent(id)}`),
  subscription: () => payRequest<PaySubscription>('/api/me/subscription'),
  cancel: (source: string) =>
    payRequest<{ ok: boolean; premium_until: number }>('/api/subscription/cancel', {
      method: 'POST',
      body: JSON.stringify({ source }),
    }),
  redeem: (code: string) =>
    payRequest<RedeemResp>('/api/redeem', { method: 'POST', body: JSON.stringify({ code }) }),
  trial: (deviceId: string | null) =>
    payRequest<{ premium_until: number }>('/api/trial', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId }),
    }),
  shared: () => payRequest<SharedOverview>('/api/shared'),
  sharedPreview: (tier: SharedTierId, planId: string) =>
    payRequest<SharedPreview>(
      `/api/shared/preview?tier=${encodeURIComponent(tier)}&plan_id=${encodeURIComponent(planId)}`,
    ),
  joinShared: (code: string) =>
    payRequest<SharedMembership>('/api/shared/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  leaveShared: () => payRequest<{ ok: boolean }>('/api/shared/leave', { method: 'POST' }),
  removeMember: (member: string) =>
    payRequest<{ ok: boolean }>('/api/shared/remove', {
      method: 'POST',
      body: JSON.stringify({ member }),
    }),
  regenerateInvite: () =>
    payRequest<{ invite_code: string }>('/api/shared/invite', { method: 'POST' }),
  boostyStartCard: (method: BoostyCardMethod) =>
    boostyPost<BoostyCardStart>('/api/boosty/start', { method }),
  boostyStartSbp: () => boostyPost<BoostySbpStart>('/api/boosty/start', { method: 'sbp' }),
  boostyStep: (sessionId: number) =>
    boostyPost<BoostyStep>('/api/boosty/step', { session_id: sessionId }),
  boostyToken: (sessionId: number, token: string) =>
    boostyPost<BoostyStep>('/api/boosty/token', { session_id: sessionId, token }),
  boostyCancel: (sessionId: number) =>
    boostyPost<BoostyBinds>('/api/boosty/cancel', { session_id: sessionId }),
  boostyBinds: () => payRequest<BoostyBinds>('/api/boosty/card'),
  boostyRemove: (method: BoostyMethod) => boostyPost<BoostyBinds>('/api/boosty/remove', { method }),
  gifts: () => payRequest<{ gifts: Gift[] }>('/api/me/gifts'),
  referral: () => payRequest<Referral>('/api/me/referral'),
  checkRef: (code: string) =>
    payRequest<{ bonus_days: number }>('/api/referral/check', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
};

/** The machine code pay puts in `message` of an error body, e.g. `trial_used`. */
export function payErrorCode(e: unknown): string | null {
  if (!(e instanceof PayError)) return null;
  try {
    return (JSON.parse(e.body) as { message?: string }).message ?? null;
  } catch {
    return null;
  }
}
