import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuthStore } from '../stores/auth';
import { type Binds, type BindView, type MethodId, payApi, runnerSupported } from './pay-client';
import { queryClient } from './query-client';
import { deviceId } from './star-offer';

export const BINDS_KEY = ['pay', 'binds'] as const;

const QR_REMOVED_TOAST_MS = 9_000;

export function useRunnerSupported(): boolean {
  const supported = useQuery({
    queryKey: ['pay', 'runner'],
    queryFn: runnerSupported,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return supported.data === true;
}

export function usePlans() {
  return useQuery({ queryKey: ['pay', 'plans'], queryFn: payApi.plans, staleTime: 300_000 });
}

export function useBinds(enabled = true) {
  const hasSession = useAuthStore((s) => s.hasSession);
  const plans = usePlans();
  return useQuery({
    queryKey: BINDS_KEY,
    queryFn: async () => payApi.binds(await deviceId()),
    staleTime: 30_000,
    enabled: enabled && hasSession && !!plans.data?.methods.some((m) => m.bind),
  });
}

export function bindOf(binds: Binds | undefined, method: MethodId): BindView | null {
  return binds?.methods.find((b) => b.method === method) ?? null;
}

export function refreshBinds() {
  void queryClient.invalidateQueries({ queryKey: BINDS_KEY });
}

export function useRemoveBind() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (method: MethodId) => payApi.bindRemove(method),
    onSuccess: (binds, method) => {
      queryClient.setQueryData(BINDS_KEY, (old: Binds | undefined) => ({ ...old, ...binds }));
      void queryClient.invalidateQueries({ queryKey: ['pay', 'subscription'] });
      const qr = bindOf(binds, method)?.flow === 'qr';
      if (qr) {
        toast.success(t('starpass.bind.sbp.removed'), {
          description: t('starpass.bind.sbp.cancelInBank'),
          duration: QR_REMOVED_TOAST_MS,
        });
      } else {
        toast.success(t('starpass.bind.removedCard'));
      }
    },
    onError: () => toast.error(t('starpass.bind.removeError')),
  });
}
