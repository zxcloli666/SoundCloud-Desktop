import { useMutation } from '@tanstack/react-query';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { linkedBinds } from '../../../lib/boosty-bind-state';
import { useBinds, useCardSupported, useRemoveBind } from '../../../lib/boosty-binds';
import { Crown, Gift, Users } from '../../../lib/icons';
import { type BoostyMethod, payApi } from '../../../lib/pay-client';
import { requestPremiumRecheck } from '../../../lib/premium-cache';
import { queryClient } from '../../../lib/query-client';
import { passDate } from '../../../lib/star-format';
import { PAY_SUB_KEY, usePaySubscription } from '../../../lib/star-offer';
import { useSharedOverview } from '../../../lib/star-shared';
import { useStarStatus } from '../../../lib/star-status';
import { DiscordCard } from '../DiscordCard';
import { ExpiringRow } from './ExpiringRow';
import { PageLink } from './LegalNote';
import { LinkedBind } from './LinkedBind';
import { MemberCard } from './MemberCard';
import { primaryEntitlement } from './meta';
import { GhostBtn } from './StarConsole';
import { TenurePanel } from './TenurePanel';
import { TrialRow } from './TrialRow';

/** Manage — Discord link, auto-renew (cancel-only), source; extend / redeem / gift / invite. */
export const ManagePane = memo(function ManagePane({
  onExtend,
  onRedeem,
  onGift,
  onInvite,
  onPlan,
  onRelink,
  onTrialEnded,
}: {
  onExtend: () => void;
  onRedeem: () => void;
  onGift: () => void;
  onInvite: () => void;
  onPlan: () => void;
  onRelink: (method: BoostyMethod) => void;
  onTrialEnded: () => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = usePaySubscription();
  const shared = useSharedOverview().data;
  const owned = shared?.owner;
  const source = data ? (primaryEntitlement(data.entitlements)?.source ?? '') : '';
  const status = useStarStatus();
  const renews = status?.kind === 'renews' ? status : null;
  const renewSource = status && status.kind !== 'ends' ? status.source : null;
  const autoRenew = renewSource !== null;
  const ending =
    status?.kind === 'ends' && status.level !== 'calm' && status.canExtend ? status : null;
  const linked = linkedBinds(useBinds().data);
  const cardSupported = useCardSupported();
  const removeBind = useRemoveBind();
  const trial = data?.trial?.active ?? null;
  const [askTrial, setAskTrial] = useState(false);

  const cancel = useMutation({
    mutationFn: () => payApi.cancel(renewSource ?? ''),
    onSuccess: () => {
      toast.success(t('starpass.manage.canceled'));
      void queryClient.invalidateQueries({ queryKey: PAY_SUB_KEY });
      requestPremiumRecheck();
    },
    onError: () => toast.error(t('starpass.manage.cancelError')),
  });

  return (
    <div className="flex flex-col gap-2.5">
      {ending && <ExpiringRow ending={ending} onExtend={onExtend} />}
      {shared?.member_of && <MemberCard plan={shared.member_of} />}
      {owned && (
        <button
          type="button"
          onClick={onPlan}
          className="flex cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-ink/[0.08] bg-ink/[0.03] px-4 py-3 text-left transition-colors hover:bg-ink/[0.06]"
        >
          <span className="flex items-center gap-2.5">
            <Crown size={16} className="text-accent" />
            <span className="text-[13px] font-medium text-ink-85">
              {t(`starpass.tier.${owned.tier}`)}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            {Array.from({ length: owned.seats }, (_, i) => (
              <span
                key={i}
                className="size-2.5 rounded-full"
                style={{
                  background:
                    i < owned.members.length ? 'var(--color-accent)' : 'rgb(var(--ink) / 0.14)',
                }}
              />
            ))}
            <span className="ml-1.5 font-mono text-[11px] text-ink-50">
              {t('starpass.shared.manageCta')}
            </span>
          </span>
        </button>
      )}
      <TenurePanel />
      <DiscordCard discord={data?.discord ?? null} />

      {trial && (
        <TrialRow
          until={trial.ends_at}
          asking={askTrial}
          onAsk={() => setAskTrial(true)}
          onKeep={() => setAskTrial(false)}
          onEnded={onTrialEnded}
        />
      )}

      {linked.map(({ method, rebind }) => (
        <LinkedBind
          key={method}
          method={method}
          rebind={rebind}
          removing={removeBind.isPending && removeBind.variables === method}
          onRemove={() => removeBind.mutate(method)}
          onRelink={method === 'sbp' || cardSupported ? () => onRelink(method) : undefined}
        />
      ))}

      <div className="flex items-center justify-between gap-3 rounded-[14px] border border-ink/[0.08] bg-ink/[0.03] px-4 py-3">
        <div>
          <div className="text-[13px] font-medium text-ink-85">
            {t('starpass.manage.autoRenew')}
          </div>
          <div className="mt-0.5 text-[11.5px] text-ink-40">
            {renews ? (
              <>
                <span className="font-medium tabular-nums text-ink-75">
                  {passDate(renews.at)} · {renews.charge}
                </span>
                {' · '}
                {t('star.in', { count: renews.days })}
                {' · '}
                <PageLink page="refund">{t('starpass.manage.refund')}</PageLink>
              </>
            ) : status?.kind === 'relink' ? (
              <span className="font-medium text-amber-400">{t('star.relink')}</span>
            ) : renewSource ? (
              t(`starpass.manage.sources.${renewSource}`, { defaultValue: renewSource })
            ) : (
              t('starpass.manage.autoRenewOff')
            )}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoRenew}
          disabled={!autoRenew || cancel.isPending || isLoading}
          onClick={() => {
            if (trial) setAskTrial(true);
            else if (autoRenew && !cancel.isPending) cancel.mutate();
          }}
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
        <span className="text-[13px] font-medium text-ink">
          {source ? t(`starpass.manage.sources.${source}`, { defaultValue: source }) : '—'}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap gap-3">
        {!ending && <GhostBtn onClick={onExtend}>{t('starpass.manage.extend')}</GhostBtn>}
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
