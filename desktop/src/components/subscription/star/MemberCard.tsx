import { useMutation } from '@tanstack/react-query';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useUser } from '../../../lib/hooks';
import { payApi, type SharedMembership } from '../../../lib/pay-client';
import { requestPremiumRecheck } from '../../../lib/premium-cache';
import { daysUntil, passDate } from '../../../lib/star-format';
import { refreshShared, sharedErrorKey, userUrn } from '../../../lib/star-shared';
import { Avatar } from '../../ui/Avatar';

/** "STAR from <owner>'s Family": whose plan covers you, until when, and the way out. */
export const MemberCard = memo(function MemberCard({ plan }: { plan: SharedMembership }) {
  const { t } = useTranslation();
  const owner = useUser(userUrn(plan.owner_sc_user_id)).data;
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

  return (
    <div className="rounded-[14px] border border-ink/[0.10] bg-ink/[0.03] px-4 py-3.5">
      <div className="flex items-center gap-3">
        <Avatar src={owner?.avatar_url} alt={owner?.username} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-ink">
            {t('starpass.shared.member.from', {
              name: owner?.username ?? '…',
              tier: t(`starpass.tier.${plan.tier}`),
            })}
          </div>
          <div className="text-[11.5px] text-ink-45">
            {t('starpass.shared.member.sub', { date: passDate(plan.ends_at) })} ·{' '}
            {t('starpass.daysLeft', { count: daysUntil(plan.ends_at) })}
          </div>
        </div>
        {!asking && (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="cursor-pointer rounded-[10px] border border-ink/[0.12] px-3 py-1.5 text-[12px] text-ink-70 transition-colors hover:bg-ink/[0.06]"
          >
            {t('starpass.shared.member.leave')}
          </button>
        )}
      </div>
      {asking && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/[0.07] pt-3">
          <span className="mr-auto text-[12px] text-ink-60">
            {t('starpass.shared.member.leaveAsk')}
          </span>
          <button
            type="button"
            disabled={leave.isPending}
            onClick={() => leave.mutate()}
            className="cursor-pointer rounded-[10px] bg-red-500/85 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {t('starpass.shared.member.leaveYes')}
          </button>
          <button
            type="button"
            onClick={() => setAsking(false)}
            className="cursor-pointer rounded-[10px] border border-ink/[0.12] px-3 py-1.5 text-[12px] text-ink-70"
          >
            {t('starpass.shared.member.leaveNo')}
          </button>
        </div>
      )}
    </div>
  );
});
