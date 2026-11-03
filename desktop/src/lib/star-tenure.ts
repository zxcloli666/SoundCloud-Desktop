import { useMemo } from 'react';
import { usePaySubscription } from './star-offer';

export type StarTier = 0 | 1 | 2 | 3;

export const MONTH_SEC = 2_629_800;
export const TIER_MONTHS = [0, 3, 6, 12] as const;

export interface Tenure {
  months: number;
  tier: StarTier;
  nextTier: StarTier | null;
  monthsToNext: number;
  progress: number;
}

export function tierOf(months: number): StarTier {
  if (months >= TIER_MONTHS[3]) return 3;
  if (months >= TIER_MONTHS[2]) return 2;
  if (months >= TIER_MONTHS[1]) return 1;
  return 0;
}

export function tenureOf(since: number | null | undefined, nowSec = Date.now() / 1000): Tenure | null {
  if (!since) return null;
  const exact = Math.max(0, (nowSec - since) / MONTH_SEC);
  const tier = tierOf(exact);
  if (tier === 3) return { months: Math.floor(exact), tier, nextTier: null, monthsToNext: 0, progress: 1 };
  const nextTier = (tier + 1) as StarTier;
  const from = TIER_MONTHS[tier];
  const to = TIER_MONTHS[nextTier];
  return {
    months: Math.floor(exact),
    tier,
    nextTier,
    monthsToNext: Math.ceil(to - exact),
    progress: (exact - from) / (to - from),
  };
}

export function tierOfSince(since: number | null | undefined): StarTier {
  return tenureOf(since)?.tier ?? 0;
}

export function useOwnTenure(): Tenure | null {
  const since = usePaySubscription().data?.star_since;
  return useMemo(() => tenureOf(since), [since]);
}
