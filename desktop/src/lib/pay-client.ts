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

export type ProviderId = 'platega' | 'cryptobot' | 'tgstars';
export type PlategaMethod = 'sbp' | 'card_ru' | 'card_intl' | 'crypto';

export interface Plan {
  id: string;
  months: number;
  period_days: number;
  price_rub: number;
  savings_pct: number;
  stars: number;
}

export interface PlansResponse {
  monthly_rub: number;
  plans: Plan[];
  providers: Record<ProviderId, boolean>;
  methods: { platega: PlategaMethod[] };
}

export interface CheckoutReq {
  plan_id: string;
  provider: ProviderId;
  method?: PlategaMethod;
  recurring?: boolean;
  gift?: boolean;
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
  entitlements: Entitlement[];
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
