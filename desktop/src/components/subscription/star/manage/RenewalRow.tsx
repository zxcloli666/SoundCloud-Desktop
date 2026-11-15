import { useMutation } from '@tanstack/react-query';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { RefreshCw } from '../../../../lib/icons';
import { type MethodId, payApi } from '../../../../lib/pay-client';
import { requestPremiumRecheck } from '../../../../lib/premium-cache';
import { queryClient } from '../../../../lib/query-client';
import { passDate } from '../../../../lib/star-format';
import { PAY_SUB_KEY, usePaySubscription } from '../../../../lib/star-offer';
import { useStarStatus } from '../../../../lib/star-status';
import { tileOf } from '../../methods';
import { useFlowApi } from '../flow/derive';
import { PageLink } from '../LegalNote';
import { IconTile, Row } from '../ui/Row';
import { Switch } from '../ui/Switch';

export const RenewalRow = memo(function RenewalRow() {
  const { t } = useTranslation();
  const { data, isLoading } = usePaySubscription();
  const status = useStarStatus();
  const api = useFlowApi();
  const renewal = data?.renewal ?? null;
  const trial = data?.trial?.active ?? null;
  const on = status !== null && status.kind !== 'ends';
  const attention = status?.kind === 'relink' || status?.kind === 'confirm';
  const cancel = useMutation({
    mutationFn: (method: MethodId) => payApi.cancel(method),
    onSuccess: () => {
      toast.success(t('starpass.manage.canceled'));
      void queryClient.invalidateQueries({ queryKey: PAY_SUB_KEY });
      requestPremiumRecheck();
    },
    onError: () => toast.error(t('starpass.manage.cancelError')),
  });
  const turnOff = () => {
    if (trial) api.askTrial(true);
    else if (renewal && !cancel.isPending) cancel.mutate(renewal.method);
  };
  return (
    <Row
      data-ui="star-autorenew"
      icon={
        <IconTile on={on}>
          <RefreshCw size={16} />
        </IconTile>
      }
      title={t('starpass.manage.autoRenew')}
      tone={attention ? 'warn' : 'plain'}
      sub={
        status?.kind === 'renews' ? (
          <span className="tabular-nums">
            <span className="font-semibold text-ink-80">
              {passDate(status.at)} · {status.charge}
            </span>
            {' · '}
            {t(`starpass.method.${tileOf(status.method).i18n}.title`)}
            {' · '}
            <PageLink page="refund">{t('starpass.manage.refund')}</PageLink>
          </span>
        ) : status?.kind === 'relink' || status?.kind === 'confirm' ? (
          t(status.kind === 'relink' ? 'star.relink' : 'star.confirmPay')
        ) : status?.kind === 'open' ? (
          t(`starpass.manage.sources.${status.category}`)
        ) : (
          t('starpass.manage.autoRenewOff')
        )
      }
    >
      <Switch
        on={on}
        disabled={!on || !renewal || cancel.isPending || isLoading}
        onChange={turnOff}
        label={t('starpass.manage.autoRenew')}
      />
    </Row>
  );
});
