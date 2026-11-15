import { useMutation } from '@tanstack/react-query';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { RefreshCw, Users } from '../../../../lib/icons';
import { payApi } from '../../../../lib/pay-client';
import { usePerfMode } from '../../../../lib/perf';
import { passDate } from '../../../../lib/star-format';
import { refreshShared, sharedErrorKey, useSharedOverview } from '../../../../lib/star-shared';
import { useFlowApi } from '../flow/derive';
import { Btn } from '../ui/Btn';
import { CodeChip } from '../ui/CodeChip';
import { CopyBtn } from '../ui/CopyBtn';
import { Title } from '../ui/Panel';
import { SeatDots } from '../ui/SeatDots';
import { FreeSeat, SeatRow } from './SeatRow';

export const SharedStep = memo(function SharedStep() {
  const { t } = useTranslation();
  const api = useFlowApi();
  const spin = usePerfMode().idleAnim;
  const { data, isLoading, isError, refetch } = useSharedOverview();
  const remove = useMutation({
    mutationFn: (member: string) => payApi.removeMember(member),
    onSuccess: () => {
      toast.success(t('starpass.shared.seat.removed'));
      refreshShared();
    },
    onError: (e) => toast.error(t(sharedErrorKey(e))),
  });
  const regenerate = useMutation({
    mutationFn: payApi.regenerateInvite,
    onSuccess: () => {
      toast.success(t('starpass.shared.invite.regenerated'));
      refreshShared();
    },
    onError: (e) => toast.error(t(sharedErrorKey(e))),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" aria-busy>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[58px] animate-pulse rounded-[14px] bg-ink/[0.05]" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-[13px] text-bad">{t('starpass.loadError')}</p>
        <Btn onClick={() => void refetch()}>{t('starpass.retry')}</Btn>
      </div>
    );
  }
  const plan = data?.owner;
  if (!plan) {
    return (
      <div data-ui="star-shared" data-state="empty">
        <Title sub={t('starpass.shared.empty.text')}>{t('starpass.shared.empty.title')}</Title>
        <Btn tone="primary" onClick={() => api.setStep('overview')}>
          <Users size={15} />
          {t('starpass.shared.empty.cta')}
        </Btn>
      </div>
    );
  }
  const free = Math.max(0, plan.seats - plan.members.length);
  return (
    <div data-ui="star-shared">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-extrabold leading-tight tracking-tight text-ink">
            {t(`starpass.tier.${plan.tier}`)}
          </h2>
          <p className="mt-1 text-[12.5px] tabular-nums text-ink-50">
            {t('starpass.shared.until', { date: passDate(plan.ends_at) })} ·{' '}
            {t('starpass.shared.seatsOf', { used: plan.members.length, seats: plan.seats })}
          </p>
        </div>
        <SeatDots used={plan.members.length} total={plan.seats} />
      </div>
      <div className="text-[12px] font-semibold text-ink-45">
        {t('starpass.shared.invite.title')}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <CodeChip code={plan.invite_code} />
        <CopyBtn
          text={t('starpass.shared.invite.shareText', {
            tier: t(`starpass.tier.${plan.tier}`),
            code: plan.invite_code,
          })}
          label={t('starpass.shared.invite.copy')}
        />
        <Btn tone="quiet" disabled={regenerate.isPending} onClick={() => regenerate.mutate()}>
          <RefreshCw
            size={13}
            className={regenerate.isPending && spin ? 'animate-spin' : undefined}
          />
          {t('starpass.shared.invite.regenerate')}
        </Btn>
      </div>
      <div className="mt-4 divide-y divide-ink/[0.07] overflow-hidden rounded-[16px] bg-ink/[0.025] shadow-[inset_0_0_0_1px_rgb(var(--ink)/0.07)]">
        {plan.members.map((m) => (
          <SeatRow
            key={m.sc_user_id}
            member={m}
            busy={remove.isPending}
            onRemove={() => remove.mutate(m.sc_user_id)}
          />
        ))}
        {Array.from({ length: free }, (_, i) => (
          <FreeSeat key={i} />
        ))}
      </div>
    </div>
  );
});
