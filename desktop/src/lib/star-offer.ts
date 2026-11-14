import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { useCardSupported } from './boosty-binds';
import { trackedInvoke as invoke } from './diagnostics';
import { payApi, type TrialStart } from './pay-client';
import { requestPremiumRecheck, usePremium } from './premium-cache';
import { queryClient } from './query-client';
import { trialOffer } from './star-trial';

export const PAY_SUB_KEY = ['pay', 'subscription'] as const;

export type StarIntent = 'buy' | 'extend' | 'trial' | 'gift' | 'invite';

export const TRIAL_DAYS = 3;

export function usePaySubscription(enabled = true) {
  const hasSession = useAuthStore((s) => s.hasSession);
  return useQuery({
    queryKey: PAY_SUB_KEY,
    queryFn: payApi.subscription,
    staleTime: 60_000,
    refetchInterval: 30 * 60_000,
    enabled: enabled && hasSession,
  });
}

/** What a free user can be offered right now: a free trial or a purchase. */
export function useStarOffer() {
  const premium = usePremium();
  const sub = usePaySubscription(!premium).data;
  const cardSupported = useCardSupported();
  const offer = premium ? null : trialOffer(sub, cardSupported);
  return { premium, trial: offer?.available === true, trialDays: offer?.days ?? TRIAL_DAYS };
}

export function useOpenStar() {
  const navigate = useNavigate();
  return useCallback(
    (intent: StarIntent = 'buy', plan?: string) => navigate('/star', { state: { intent, plan } }),
    [navigate],
  );
}

async function deviceId(): Promise<string | null> {
  try {
    return await invoke<string>('call_device_id');
  } catch {
    return null;
  }
}

export async function trialStart(): Promise<TrialStart> {
  return { purpose: 'trial', device_id: await deviceId() };
}

export function refreshSubscription() {
  void queryClient.invalidateQueries({ queryKey: PAY_SUB_KEY });
  requestPremiumRecheck();
}
