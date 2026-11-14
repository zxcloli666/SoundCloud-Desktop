import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuthStore } from '../stores/auth';
import { cardNative } from './boosty-card/native';
import { type BoostyBinds, type BoostyMethod, payApi } from './pay-client';
import { queryClient } from './query-client';

export const BOOSTY_BINDS_KEY = ['pay', 'boosty', 'binds'] as const;

const SBP_REMOVED_TOAST_MS = 9_000;

export function useCardSupported(): boolean {
  const supported = useQuery({
    queryKey: ['pay', 'boosty', 'supported'],
    queryFn: cardNative.supported,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return supported.data === true;
}

export function useBinds(enabled = true) {
  const hasSession = useAuthStore((s) => s.hasSession);
  const plans = useQuery({ queryKey: ['pay', 'plans'], queryFn: payApi.plans, staleTime: 300_000 });
  return useQuery({
    queryKey: BOOSTY_BINDS_KEY,
    queryFn: payApi.boostyBinds,
    staleTime: 30_000,
    enabled: enabled && hasSession && plans.data?.providers.boostycard === true,
  });
}

export function refreshBinds() {
  void queryClient.invalidateQueries({ queryKey: BOOSTY_BINDS_KEY });
}

export function useRemoveBind() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (method: BoostyMethod) => payApi.boostyRemove(method),
    onSuccess: (binds: BoostyBinds, method) => {
      queryClient.setQueryData(BOOSTY_BINDS_KEY, binds);
      void queryClient.invalidateQueries({ queryKey: ['pay', 'subscription'] });
      if (method === 'sbp') {
        toast.success(t('starpass.bind.sbp.removed'), {
          description: t('starpass.bind.sbp.cancelInBank'),
          duration: SBP_REMOVED_TOAST_MS,
        });
      } else {
        toast.success(t('starpass.bind.card.removed'));
      }
    },
    onError: () => toast.error(t('starpass.bind.removeError')),
  });
}
