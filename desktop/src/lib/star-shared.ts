import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth';
import {
  type Plan,
  payApi,
  payErrorCode,
  type SharedTier,
  type SharedTierId,
  type TierId,
} from './pay-client';
import { queryClient } from './query-client';
import { PAY_SUB_KEY } from './star-offer';

export const SHARED_KEY = ['pay', 'shared'] as const;

export const INVITE_RE = /^JOIN(-[0-9A-Z]{4}){3}$/;

export function useSharedOverview(enabled = true) {
  const hasSession = useAuthStore((s) => s.hasSession);
  return useQuery({
    queryKey: SHARED_KEY,
    queryFn: payApi.shared,
    staleTime: 30_000,
    enabled: enabled && hasSession,
  });
}

export function useSharedPreview(tier: TierId, planId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...SHARED_KEY, 'preview', tier, planId],
    queryFn: () => payApi.sharedPreview(tier as SharedTierId, planId as string),
    enabled: enabled && tier !== 'solo' && !!planId,
    staleTime: 20_000,
  });
}

export function refreshShared() {
  void queryClient.invalidateQueries({ queryKey: SHARED_KEY });
  void queryClient.invalidateQueries({ queryKey: PAY_SUB_KEY });
}

export function userUrn(scUserId: string): string {
  return `soundcloud:users:${scUserId}`;
}

export interface PerPerson {
  each: number;
  savePct: number;
}

/** What each person pays in a shared plan, and how much cheaper than a personal one. */
export function perPerson(
  plan: Plan | undefined,
  solo: Plan | undefined,
  seats: number,
): PerPerson {
  if (!plan || !solo) return { each: 0, savePct: 0 };
  const each = Math.round(plan.price_rub / (seats + 1));
  return { each, savePct: Math.max(0, Math.round((1 - each / solo.price_rub) * 100)) };
}

export function tierPlans(tier: TierId, solo: Plan[], shared: SharedTier[] | undefined): Plan[] {
  if (tier === 'solo') return solo;
  return shared?.find((s) => s.tier === tier)?.plans ?? [];
}

const KNOWN_ERRORS = [
  'invite_invalid',
  'plan_full',
  'plan_expired',
  'own_plan',
  'owner_of_plan',
  'already_member',
  'in_other_plan',
  'member_of_plan',
  'too_many_members',
  'removal_limit',
  'not_a_member',
  'no_card',
  'no_sbp',
] as const;

/** i18n key of a shared-plan failure; unknown ones fall back to a generic text. */
export function sharedErrorKey(e: unknown): string {
  const code = payErrorCode(e);
  const known = KNOWN_ERRORS.find((k) => k === code);
  return `starpass.shared.error.${known ?? 'generic'}`;
}
