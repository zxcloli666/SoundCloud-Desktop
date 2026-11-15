import { useMutation } from '@tanstack/react-query';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useUser } from '../../../../lib/hooks';
import { payApi } from '../../../../lib/pay-client';
import { requestPremiumRecheck } from '../../../../lib/premium-cache';
import { daysUntil, passDate } from '../../../../lib/star-format';
import {
  refreshShared,
  sharedErrorKey,
  userUrn,
  useSharedOverview,
} from '../../../../lib/star-shared';
import { Avatar } from '../../../ui/Avatar';
import { Btn } from '../ui/Btn';
import { Panel } from '../ui/Panel';

export const MemberCard = memo(function MemberCard() {
  const { t } = useTranslation();
  const plan = useSharedOverview().data?.member_of ?? null;
  const owner = useUser(plan ? userUrn(plan.owner_sc_user_id) : undefined).data;
  const [asking, setAsking] = useState(false);
  const leave = useMutation({
    mutationFn: payApi.leaveShared,
    onSuccess: () => {
      toast.success(t('starpass.shared.member.left'));
      refreshShared();
      requestPremiumRecheck();
    },
    onError: (e) => toast.error(t(sharedErrorKey(e))),
  });
  if (!plan) return null;
  return (
    <Panel data-ui="star-member">
      <div className="flex items-center gap-3">
        <Avatar src={owner?.avatar_url} alt={owner?.username} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold text-ink">
            {t('starpass.shared.member.from', {
              name: owner?.username ?? '…',
              tier: t(`starpass.tier.${plan.tier}`),
            })}
          </div>
          <div className="text-[12px] tabular-nums text-ink-45">
            {t('starpass.shared.member.sub', { date: passDate(plan.ends_at) })} ·{' '}
            {t('starpass.daysLeft', { count: daysUntil(plan.ends_at) })}
          </div>
        </div>
        {!asking && (
          <Btn size="sm" onClick={() => setAsking(true)}>
            {t('starpass.shared.member.leave')}
          </Btn>
        )}
      </div>
      {asking && (
        <div className="star-in mt-3 flex flex-wrap items-center gap-2 border-t border-ink/[0.07] pt-3">
          <span className="mr-auto text-[12.5px] text-ink-60">
            {t('starpass.shared.member.leaveAsk')}
          </span>
          <Btn size="sm" tone="quiet" onClick={() => setAsking(false)}>
            {t('starpass.shared.member.leaveNo')}
          </Btn>
          <Btn size="sm" tone="bad" disabled={leave.isPending} onClick={() => leave.mutate()}>
            {t('starpass.shared.member.leaveYes')}
          </Btn>
        </div>
      )}
    </Panel>
  );
});
