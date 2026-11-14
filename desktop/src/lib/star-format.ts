// Display helpers for the STAR PASS membership artifact. Pure formatting only —
// no network, no heavy logic (keeps the frontend thin).

/** Stable short serial derived from an order/entitlement id, e.g. "SC-7F2A-09K4". */
export function passSerial(seed: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  const block = (n: number) =>
    Array.from({ length: 4 }, (_, i) => alpha[(n >>> (i * 5)) % alpha.length]).join('');
  const h2 = Math.imul(h ^ 0x9e3779b9, 2654435761) >>> 0;
  return `SC-${block(h)}-${block(h2)}`;
}

/** Unix-seconds → "21.07.2027" (always dd.mm.yyyy for the mono field grid). */
export function passDate(epochSec: number | null | undefined): string {
  if (!epochSec) return '—';
  const d = new Date(epochSec * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function shortDate(epochSec: number): string {
  return passDate(epochSec).slice(0, 5);
}

/** Whole days remaining until an epoch-seconds deadline (never negative). */
export function daysUntil(epochSec: number | null | undefined): number {
  if (!epochSec) return 0;
  return Math.max(0, Math.ceil((epochSec * 1000 - Date.now()) / 86_400_000));
}

/** Format an integer ruble amount for the mono price fields, e.g. "2490 ₽". */
export function rub(amount: number): string {
  return `${amount} ₽`;
}

export function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function planPrice(
  plan: { price_rub: number; price_usd_cents?: number },
  currency: 'RUB' | 'USD',
): string {
  if (currency === 'USD' && plan.price_usd_cents != null) return usd(plan.price_usd_cents);
  return rub(plan.price_rub);
}

const CURRENCY_SIGN: Record<string, string> = { XTR: '★', RUB: '₽' };

export function chargeAmount(amount: number, currency: string): string {
  if (currency === 'USD') return usd(amount);
  return `${amount} ${CURRENCY_SIGN[currency] ?? currency}`;
}
