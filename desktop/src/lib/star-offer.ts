import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { trackedInvoke as invoke } from './diagnostics';
import { payApi } from './pay-client';
import { requestPremiumRecheck, usePremium } from './premium-cache';
import { queryClient } from './query-client';

export const PAY_SUB_KEY = ['pay', 'subscription'] as const;

export type StarIntent = 'buy' | 'extend' | 'trial' | 'gift' | 'invite';

export const TRIAL_DAYS = 3;

export function usePaySubscription(enabled = true) {
  const hasSession = useAuthStore((s) => s.hasSession);
  return useQuery({
    queryKey: PAY_SUB_KEY,
    queryFn: payApi.subscription,
    staleTime: 60_000,
    enabled: enabled && hasSession,
  });
}

/** What a free user can be offered right now: a free trial or a purchase. */
export function useStarOffer() {
  const premium = usePremium();
  const sub = usePaySubscription(!premium).data;
  return { premium, trial: !premium && sub?.trial_available === true };
}

export function useOpenStar() {
  const navigate = useNavigate();
  return useCallback(
    (intent: StarIntent = 'buy') => navigate('/star', { state: { intent } }),
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

export function useStartTrial() {
  return useMutation({
    mutationFn: async () => payApi.trial(await deviceId()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PAY_SUB_KEY });
      requestPremiumRecheck();
    },
  });
}
