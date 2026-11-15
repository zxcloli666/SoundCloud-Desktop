import { useTranslation } from 'react-i18next';
import type { MethodId, PaySubscription, Renewal, SourceCategory } from './pay-client';
import { usePremium } from './premium-cache';
import { chargeAmount, daysUntil, passDate, shortDate } from './star-format';
import { usePaySubscription } from './star-offer';
import { useSharedOverview } from './star-shared';

export const SOON_DAYS = 7;
export const URGENT_DAYS = 3;
const TRIAL_SOON_DAYS = 1;

export interface StarRenews {
  kind: 'renews';
  at: number;
  days: number;
  charge: string;
  method: MethodId;
  soon: boolean;
  trialUntil: number | null;
}

export interface StarEnds {
  kind: 'ends';
  at: number;
  days: number;
  level: 'calm' | 'soon' | 'urgent';
  trial: boolean;
  canExtend: boolean;
}

export interface StarRelink {
  kind: 'relink';
  at: number;
  method: MethodId;
}

export interface StarConfirm {
  kind: 'confirm';
  at: number;
  charge: string;
  method: MethodId;
  renewal: Renewal;
}

export interface StarOpen {
  kind: 'open';
  category: SourceCategory;
}

export type StarStatus = StarRenews | StarRelink | StarConfirm | StarEnds | StarOpen;

export function starStatus(sub: PaySubscription, member: boolean): StarStatus {
  const renewal = sub.renewal;
  if (renewal) {
    const charge = chargeAmount(renewal.amount_minor, renewal.currency);
    if (renewal.relink) return { kind: 'relink', at: renewal.at, method: renewal.method };
    if (renewal.needs_confirm) {
      return { kind: 'confirm', at: renewal.at, charge, method: renewal.method, renewal };
    }
    const days = daysUntil(renewal.at);
    const trialUntil = renewal.trial ? (sub.trial?.active?.ends_at ?? renewal.at) : null;
    return {
      kind: 'renews',
      at: renewal.at,
      days,
      charge,
      method: renewal.method,
      soon: days <= (trialUntil ? TRIAL_SOON_DAYS : URGENT_DAYS),
      trialUntil,
    };
  }

  const now = Date.now() / 1000;
  const active = sub.sources.filter((s) => s.ends_at > now);
  const external = active.find((s) => s.renews);
  if (external) return { kind: 'open', category: external.category };

  const days = daysUntil(sub.premium_until);
  return {
    kind: 'ends',
    at: sub.premium_until,
    days,
    level: days <= URGENT_DAYS ? 'urgent' : days <= SOON_DAYS ? 'soon' : 'calm',
    trial: active.length > 0 && active.every((s) => s.category === 'trial'),
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
  if (status.kind === 'renews' && status.trialUntil) {
    return t('starpass.trial.until', { date: shortDate(status.trialUntil) });
  }
  if (status.kind === 'renews') return `↻ ${shortDate(status.at)} · ${status.charge}`;
  if (status.kind === 'relink') return `↻ ${t('star.relink')}`;
  if (status.kind === 'confirm') return `↻ ${t('star.confirmPay')}`;
  if (status.level === 'calm') return t('star.until', { date: passDate(status.at) });
  return t('starMoments.expiry.left', { count: status.days });
}
