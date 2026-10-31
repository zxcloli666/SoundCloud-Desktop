import { useMutation } from '@tanstack/react-query';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Gift, Users } from '../../../lib/icons';
import { payApi } from '../../../lib/pay-client';
import { requestPremiumRecheck } from '../../../lib/premium-cache';
import { queryClient } from '../../../lib/query-client';
import { passDate } from '../../../lib/star-format';
import { PAY_SUB_KEY, usePaySubscription } from '../../../lib/star-offer';
import { DiscordCard } from '../DiscordCard';
import { primaryEntitlement } from './meta';
import { GhostBtn } from './StarConsole';

/** Manage — Discord link, auto-renew (cancel-only), source; extend / redeem / gift / invite. */
export const ManagePane = memo(function ManagePane({
  onExtend,
  onRedeem,
  onGift,
  onInvite,
}: {
  onExtend: () => void;
  onRedeem: () => void;
  onGift: () => void;
  onInvite: () => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = usePaySubscription();
  const ent = data ? primaryEntitlement(data.entitlements) : null;
  const source = ent?.source ?? '';
  const endsAt = ent?.ends_at ?? data?.premium_until ?? 0;
  const autoRenew = !!ent?.auto_renew && !ent?.canceled;

  const cancel = useMutation({
    mutationFn: () => payApi.cancel(source),
    onSuccess: () => {
      toast.success(t('starpass.manage.canceled'));
      void queryClient.invalidateQueries({ queryKey: PAY_SUB_KEY });
      requestPremiumRecheck();
    },
    onError: () => toast.error(t('starpass.manage.cancelError')),
  });

  return (
    <div className="flex flex-col gap-2.5">
      <DiscordCard discord={data?.discord ?? null} />

      <div className="flex items-center justify-between gap-3 rounded-[14px] border border-ink/[0.08] bg-ink/[0.03] px-4 py-3">
        <div>
          <div className="text-[13px] font-medium text-ink-85">
            {t('starpass.manage.autoRenew')}
          </div>
          <div className="mt-0.5 text-[11.5px] text-ink-40">
            {autoRenew
              ? t('starpass.manage.autoRenewOn', { date: passDate(endsAt) })
              : t('starpass.manage.autoRenewOff')}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoRenew}
          disabled={!autoRenew || cancel.isPending || isLoading || !source}
          onClick={() => autoRenew && !cancel.isPending && cancel.mutate()}
          className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full border border-ink/[0.12] transition-all duration-300 disabled:cursor-default"
          style={{
            background: autoRenew
              ? 'color-mix(in srgb, var(--color-accent) 22%, transparent)'
              : 'rgb(var(--ink) / 0.04)',
          }}
        >
          <span
            className="absolute top-0.5 size-5 rounded-full transition-all duration-300"
            style={{
              left: autoRenew ? 22 : 2,
              background: autoRenew ? 'var(--color-accent)' : 'rgb(var(--ink) / 0.4)',
            }}
          />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-[14px] border border-ink/[0.08] bg-ink/[0.03] px-4 py-3">
        <div>
          <div className="text-[13px] font-medium text-ink-85">{t('starpass.manage.source')}</div>
          <div className="mt-0.5 text-[11.5px] text-ink-40">{t('starpass.manage.sourceSub')}</div>
        </div>
        <span className="font-mono text-[13px] text-ink">{source || '—'}</span>
      </div>

      <div className="mt-1 flex flex-wrap gap-3">
        <GhostBtn onClick={onExtend}>{t('starpass.manage.extend')}</GhostBtn>
        <GhostBtn onClick={onRedeem}>{t('starpass.manage.redeem')}</GhostBtn>
        <GhostBtn onClick={onGift}>
          <Gift size={14} />
          {t('starpass.gift.cta')}
        </GhostBtn>
        <GhostBtn onClick={onInvite}>
          <Users size={14} />
          {t('starpass.invite.cta')}
        </GhostBtn>
      </div>
    </div>
  );
});
