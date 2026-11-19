import type { PayOffer, Price } from './pay-client';
import { rub, usd } from './star-format';
import { useNowMs } from './tick';

const HOUR_MS = 3_600_000;
const DAY_SECS = 86_400;

export const money = (offer: PayOffer, price: Price) =>
  (offer.currency === 'USD' ? usd(price.USD) : rub(price.RUB)).replace(' ', '\u00a0');

export const monthsOf = (offer: PayOffer) => (offer.grant_days >= 60 ? 'two' : 'one');

export const renewalAt = (offer: PayOffer) =>
  Math.floor(Date.now() / 1000) + offer.grant_days * DAY_SECS;

const windowMs = (offer: PayOffer) => (offer.requires_bind ? 48 : 72) * HOUR_MS;

export function leftShare(offer: PayOffer, now: number): number {
  if (offer.ends_at === null) return 1;
  return Math.min(1, Math.max(0, (offer.ends_at * 1000 - now) / windowMs(offer)));
}

export function useOfferNow(endsAt: number | null): number {
  const live = endsAt !== null && endsAt * 1000 - Date.now() <= 24 * HOUR_MS;
  return useNowMs(live ? 1000 : 60_000, endsAt !== null);
}

export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(total / 3600))}:${p(Math.floor((total % 3600) / 60))}:${p(total % 60)}`;
}

export const isLastDay = (endsAt: number, now: number) => endsAt * 1000 - now <= 24 * HOUR_MS;
