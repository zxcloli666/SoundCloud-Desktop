import { useMutation } from '@tanstack/react-query';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Clock } from '../../../../lib/icons';
import { payApi } from '../../../../lib/pay-client';
import { passDate } from '../../../../lib/star-format';
import { refreshSubscription, usePaySubscription } from '../../../../lib/star-offer';
import { useFlowApi } from '../flow/derive';
import { useFlow } from '../flow/store';
import { Btn } from '../ui/Btn';
import { IconTile, Row } from '../ui/Row';

export const TrialRow = memo(function TrialRow() {
  const { t } = useTranslation();
  const trial = usePaySubscription().data?.trial?.active ?? null;
  const asking = useFlow((s) => s.askTrial);
  const api = useFlowApi();
  const cancel = useMutation({
    mutationFn: () => payApi.cancel(trial?.method ?? 'card_ru'),
    onSuccess: () => {
      toast.success(t('starpass.trial.canceled'));
      refreshSubscription();
      api.askTrial(false);
      api.setStep('overview');
    },
    onError: () => toast.error(t('starpass.trial.cancelError')),
  });
  if (!trial) return null;
  return (
    <Row
      ui="star-trial-row"
      icon={
        <IconTile>
          <Clock size={16} />
        </IconTile>
      }
      title={t('starpass.trial.until', { date: passDate(trial.ends_at) })}
      sub={asking ? t('starpass.trial.cancelConfirm') : undefined}
      tone={asking ? 'bad' : 'plain'}
    >
      {asking && !cancel.isPending && (
        <Btn size="sm" tone="quiet" onClick={() => api.askTrial(false)}>
          {t('starpass.bind.keep')}
        </Btn>
      )}
      <Btn
        size="sm"
        tone={asking ? 'bad' : 'quiet'}
        disabled={cancel.isPending}
        onClick={() => (asking ? cancel.mutate() : api.askTrial(true))}
      >
        {t('starpass.trial.cancel')}
      </Btn>
    </Row>
  );
});
