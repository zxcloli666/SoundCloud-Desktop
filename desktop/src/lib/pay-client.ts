// Client for the STAR payment backend (pay). Separate from the catalog `api()`
// host-routing client: pay is its own service, authed with the same x-session-id
// (pay resolves it against the backend — the client never asserts a user id).

// Native HTTP (from Rust), same as the catalog api-client — bypasses the webview's
// CORS preflight and the scproxy asset router (browser fetch to pay 403'd on both).
import { getSessionId } from './api-client';
import { APP_VERSION, PAY_BASE } from './constants';
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

export class PayShapeError extends PayError {
  constructor(path: string) {
    super(0, `no api 2 marker on ${path}`);
    this.name = 'PayShapeError';
  }
}

const API = 2;
const RUNNER_CAPS = 'runner=2; flows=open,qr,card_form,confirm';
const PLAIN_CAPS = 'runner=0; flows=open,qr';

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

let runner: Promise<boolean> | null = null;

export function runnerSupported(): Promise<boolean> {
  runner ??= invoke<boolean>('card_supported').catch(() => false);
  return runner;
}

async function payRequest<T>(path: string, init: RequestInit = {}, marked = false): Promise<T> {
  const headers = new Headers(init.headers);
  const sid = await sessionToken();
  if (sid) headers.set('x-session-id', sid);
  headers.set('x-app-version', APP_VERSION);
  headers.set('x-pay-caps', (await runnerSupported()) ? RUNNER_CAPS : PLAIN_CAPS);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  const res = await edgeFetch(`${PAY_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new PayError(res.status, text);
  const body = text ? (JSON.parse(text) as T) : (undefined as T);
  if (marked && (body as { api?: number } | undefined)?.api !== API) {
    throw new PayShapeError(path.split('?')[0]);
  }
  return body;
}

const shaped = <T>(path: string, init?: RequestInit) => payRequest<T>(path, init, true);

const post = <T>(path: string, body?: object) =>
  shaped<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

export type MethodId = 'sbp' | 'card_ru' | 'card_intl' | 'crypto' | 'stars';
export type Currency = 'RUB' | 'USD' | 'XTR';

export interface Price {
  RUB: number;
  /** Cents. */
  USD: number;
  XTR?: number;
}

export interface Plan {
  id: string;
  months: number;
  period_days: number;
  savings_pct: number;
  price: Price;
}

export type SharedTierId = 'duo' | 'family';
export type TierId = 'solo' | SharedTierId;

export interface SharedTier {
  tier: SharedTierId;
  /** Members besides the owner. */
  seats: number;
  plans: Plan[];
}

export type OnceFlow = 'open' | 'qr' | 'charge';
export type BindFlow = 'qr' | 'card_form';

export interface PayMethod {
  id: MethodId;
  tag: 'ru' | 'world';
  currency: Currency;
  flow: OnceFlow;
  bind: { flow: BindFlow; currency: Currency } | null;
  renew_plans: string[];
  period_days: number | null;
  gift: boolean;
  shared: boolean;
}

export interface PlansResponse {
  api: 2;
  plans: Plan[];
  shared: SharedTier[];
  methods: PayMethod[];
}

export interface CheckoutReq {
  plan_id: string;
  method: MethodId;
  recurring: boolean;
  idempotency_key: string;
  gift?: boolean;
  tier?: SharedTierId;
  ref?: string;
  offer_id?: string;
}

export interface RunnerBundle {
  contract: 2;
  serial: number;
  not_after: number;
  kid: string;
  entry: string;
  flow: 'card_form' | 'confirm';
  allowed_hosts: string[];
  page_hosts: string[];
  script: string;
  sig: string;
}

export type AltKind = 'app' | 'web' | 'mini';

export type OrderAction =
  | { type: 'qr'; qr: string; url: string | null }
  | { type: 'open'; url: string; alt: { kind: AltKind; url: string }[] }
  | { type: 'wait' }
  | { type: 'confirm'; url: string; bundle: RunnerBundle };

export type OrderStatusId = 'pending' | 'granted' | 'failed' | 'expired' | 'refunded';
export type OrderReason = 'declined' | 'relink' | 'aborted' | 'expired' | 'confirm_closed';

export interface Order {
  api: 2;
  order_id: string;
  status: OrderStatusId;
  reason: OrderReason | string | null;
  method: MethodId;
  plan_id: string;
  tier: string;
  amount_minor: number;
  currency: Currency;
  recurring: boolean;
  gift: boolean;
  gift_code: string | null;
  expires_at: number;
  paid_at: number | null;
  granted_at: number | null;
  premium_until: number;
  action: OrderAction | null;
}

export type SourceCategory =
  | 'paid'
  | 'code'
  | 'supporter'
  | 'admin'
  | 'community'
  | 'trial'
  | 'referral'
  | 'shared'
  | 'other';

export interface Source {
  category: SourceCategory;
  ends_at: number;
  renews: boolean;
}

export interface Renewal {
  at: number;
  amount_minor: number;
  currency: Currency;
  period_days: number;
  method: MethodId;
  trial: boolean;
  relink: boolean;
  needs_confirm: boolean;
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
  api: 2;
  premium: boolean;
  premium_until: number;
  star_since: number | null;
  /** When the latest STAR of any source ended; null if never had one. */
  last_ended_at: number | null;
  sources: Source[];
  renewal: Renewal | null;
  trial: TrialOffer;
  /** Mirror of the user's linked Discord (bot-owned). Null if not linked. */
  discord: DiscordLink | null;
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

export interface PayQr {
  uri: string;
  png: string;
}

export type BindState = 'none' | 'linked' | 'rebind';

export interface BindView {
  method: MethodId;
  state: BindState;
  can_link: boolean;
  flow: BindFlow;
}

export interface TrialGrant {
  ends_at: number;
  charge_at: number;
  amount_minor: number;
  currency: Currency;
}

export interface TrialActive extends TrialGrant {
  method: MethodId;
}

export type TrialRefusal = 'used' | 'has_star' | 'device_used' | 'card_used';
export type TrialReason = TrialRefusal | 'no_methods';

export interface TrialOffer {
  available: boolean;
  days: number;
  methods: MethodId[];
  reason: TrialReason | null;
  active: TrialActive | null;
}

export interface Binds {
  api: 2;
  methods: BindView[];
  trial?: TrialOffer;
}

export interface BindOpen {
  api: 2;
  state: 'open';
  session_id: number;
  method: MethodId;
  flow: BindFlow;
  expires_at: number;
  qr: PayQr | null;
  runner: { bundle: RunnerBundle; params: Record<string, unknown> } | null;
}

export interface BindGranted {
  api: 2;
  state: 'granted';
  trial: TrialGrant;
}

export type BindStart = BindOpen | BindGranted;

export type StepState = 'pending' | 'linked' | 'failed' | 'expired';

export interface BindStep {
  api: 2;
  state: StepState;
  reason: string | null;
  qr: PayQr | null;
  page_url: string | null;
  trial: TrialGrant | null;
  trial_refused: string | null;
}

export interface PayOffer {
  id: string;
  plan_id: string;
  price: Price;
  list_price: Price | null;
  currency: 'RUB' | 'USD';
  requires_bind: boolean;
  grant_days: number;
  renews_at_price: Price | null;
  /** Unix seconds; null until the offer was shown once. */
  ends_at: number | null;
  proof: { plays: number; days: number };
}

export interface OfferResponse {
  api: 2;
  offer: PayOffer | null;
}

export interface TrialStart {
  purpose: 'trial';
  device_id: string | null;
}

const withDevice = (path: string, deviceId: string | null) =>
  deviceId ? `${path}?device_id=${encodeURIComponent(deviceId)}` : path;

export const payApi = {
  plans: () => shaped<PlansResponse>('/api/plans'),
  checkout: (req: CheckoutReq) => post<Order>('/api/checkout', req),
  order: (id: string) => shaped<Order>(`/api/orders/${encodeURIComponent(id)}`),
  subscription: (deviceId: string | null) =>
    shaped<PaySubscription>(withDevice('/api/me/subscription', deviceId)),
  cancel: (method: MethodId) =>
    post<{ ok: boolean; premium_until: number }>('/api/subscription/cancel', { method }),
  redeem: (code: string) =>
    payRequest<RedeemResp>('/api/redeem', { method: 'POST', body: JSON.stringify({ code }) }),
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
  binds: (deviceId: string | null) => shaped<Binds>(withDevice('/api/binds', deviceId)),
  bindStart: (method: MethodId, trial?: TrialStart) =>
    post<BindStart>('/api/binds/start', { method, ...trial }),
  bindStep: (sessionId: number) => post<BindStep>('/api/binds/step', { session_id: sessionId }),
  bindToken: (sessionId: number, token: string) =>
    post<BindStep>('/api/binds/token', { session_id: sessionId, token }),
  bindCancel: (sessionId: number) => post<Binds>('/api/binds/cancel', { session_id: sessionId }),
  bindRemove: (method: MethodId) => post<Binds>('/api/binds/remove', { method }),
  offer: (deviceId: string | null) => shaped<OfferResponse>(withDevice('/api/me/offer', deviceId)),
  offerShown: (id: string, deviceId: string | null) =>
    post<OfferResponse>(withDevice(`/api/me/offer/${encodeURIComponent(id)}/shown`, deviceId)),
  offerDismiss: (id: string) =>
    post<OfferResponse>(`/api/me/offer/${encodeURIComponent(id)}/dismiss`),
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
  if (!(e instanceof PayError) || e.status === 0) return null;
  try {
    return (JSON.parse(e.body) as { message?: string }).message ?? null;
  } catch {
    return null;
  }
}
