import { useMutation } from '@tanstack/react-query';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { payApi } from '../../../lib/pay-client';
import { passDate } from '../../../lib/star-format';
import { refreshSubscription } from '../../../lib/star-offer';
import { LinkBtn, PillBtn } from './StarConsole';

export const TrialRow = memo(function TrialRow({
  until,
  asking,
  onAsk,
  onKeep,
  onEnded,
}: {
  until: number;
  asking: boolean;
  onAsk: () => void;
  onKeep: () => void;
  onEnded: () => void;
}) {
  const { t } = useTranslation();
  const cancel = useMutation({
    mutationFn: payApi.trialCancel,
    onSuccess: () => {
      toast.success(t('starpass.trial.canceled'));
      refreshSubscription();
      onEnded();
    },
    onError: () => toast.error(t('starpass.trial.cancelError')),
  });

  return (
    <div
      data-ui="star-trial-row"
      className={`flex items-center justify-between gap-3 rounded-[14px] border px-4 py-3 ${asking ? 'border-bad/40 bg-bad/[0.05]' : 'border-ink/[0.08] bg-ink/[0.03]'}`}
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink-85">
          {t('starpass.trial.until', { date: passDate(until) })}
        </div>
        {asking && (
          <div className="mt-0.5 text-[11.5px] leading-relaxed text-bad">
            {t('starpass.trial.cancelConfirm')}
          </div>
        )}
      </div>
      <span className="flex shrink-0 items-center gap-3">
        {asking && !cancel.isPending && (
          <LinkBtn onClick={onKeep}>{t('starpass.bind.keep')}</LinkBtn>
        )}
        <PillBtn
          tone={asking ? 'bad' : 'quiet'}
          disabled={cancel.isPending}
          onClick={() => (asking ? cancel.mutate() : onAsk())}
        >
          {t('starpass.trial.cancel')}
        </PillBtn>
      </span>
    </div>
  );
});
