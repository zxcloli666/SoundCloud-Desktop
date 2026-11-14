import { useTranslation } from 'react-i18next';
import type { PaySubscription } from './pay-client';
import { usePremium } from './premium-cache';
import { chargeAmount, daysUntil, passDate, shortDate } from './star-format';
import { usePaySubscription } from './star-offer';
import { useSharedOverview } from './star-shared';

export const SOON_DAYS = 7;
export const URGENT_DAYS = 3;

export interface StarRenews {
  kind: 'renews';
  at: number;
  days: number;
  charge: string;
  source: string;
  soon: boolean;
}

export interface StarEnds {
  kind: 'ends';
  at: number;
  days: number;
  level: 'calm' | 'soon' | 'urgent';
  trial: boolean;
  canExtend: boolean;
}

export interface StarOpen {
  kind: 'open';
  source: string;
}

export type StarStatus = StarRenews | StarEnds | StarOpen;

export function starStatus(sub: PaySubscription, member: boolean): StarStatus {
  if (sub.renewal) {
    const days = daysUntil(sub.renewal.at);
    return {
      kind: 'renews',
      at: sub.renewal.at,
      days,
      charge: chargeAmount(sub.renewal.amount, sub.renewal.currency),
      source: sub.renewal.source,
      soon: days <= URGENT_DAYS,
    };
  }

  const now = Date.now() / 1000;
  const active = sub.entitlements.filter((e) => e.ends_at > now);
  const external = active.find((e) => e.recurring && e.auto_renew && !e.canceled);
  if (external) return { kind: 'open', source: external.source };

  const days = daysUntil(sub.premium_until);
  return {
    kind: 'ends',
    at: sub.premium_until,
    days,
    level: days <= URGENT_DAYS ? 'urgent' : days <= SOON_DAYS ? 'soon' : 'calm',
    trial: active.length > 0 && active.every((e) => e.source === 'trial'),
    canExtend: !member,
  };
}

export function useStarStatus(): StarStatus | null {
  const premium = usePremium();
  const { data } = usePaySubscription(premium);
  const member = useSharedOverview(premium).data?.role === 'member';
  if (!premium || !data?.premium) return null;
  return starStatus(data, member);
}

export function useStarLine(status: StarStatus | null): string | null {
  const { t } = useTranslation();
  if (!status) return null;
  if (status.kind === 'open') return t('star.active');
  if (status.kind === 'renews') return `↻ ${shortDate(status.at)} · ${status.charge}`;
  if (status.level === 'calm') return t('star.until', { date: passDate(status.at) });
  return t('starMoments.expiry.left', { count: status.days });
}
