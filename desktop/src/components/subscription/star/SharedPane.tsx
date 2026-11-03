import { useMutation } from '@tanstack/react-query';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, Copy, RefreshCw } from '../../../lib/icons';
import { payApi } from '../../../lib/pay-client';
import { passDate } from '../../../lib/star-format';
import { refreshShared, sharedErrorKey, useSharedOverview } from '../../../lib/star-shared';
import { FreeSeat, SeatRow } from './SeatRow';
import { GhostBtn, LinkBtn, PrimaryBtn, Ttl } from './StarConsole';

/** Owner's panel: invite code, seats with members, removal. */
export const SharedPane = memo(function SharedPane({ onChoose }: { onChoose: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useSharedOverview();
  const [copied, setCopied] = useState(false);

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
      <div>
        <p className="text-[13px] text-red-200/90">{t('starpass.loadError')}</p>
        <div className="mt-3">
          <GhostBtn onClick={() => void refetch()}>{t('starpass.retry')}</GhostBtn>
        </div>
      </div>
    );
  }
  const plan = data?.owner;
  if (!plan) {
    return (
      <div>
        <Ttl>{t('starpass.shared.empty.title')}</Ttl>
        <p className="mb-4 text-[13px] text-ink-55">{t('starpass.shared.empty.text')}</p>
        <PrimaryBtn onClick={onChoose}>{t('starpass.shared.empty.cta')}</PrimaryBtn>
      </div>
    );
  }

  const copy = () => {
    const text = t('starpass.shared.invite.shareText', {
      tier: t(`starpass.tier.${plan.tier}`),
      code: plan.invite_code,
    });
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  const free = Math.max(0, plan.seats - plan.members.length);

  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <Ttl>
          {t(`starpass.tier.${plan.tier}`)} ·{' '}
          {t('starpass.shared.until', { date: passDate(plan.ends_at) })}
        </Ttl>
        <span className="mb-3.5 font-mono text-[11px] text-ink-45">
          {t('starpass.shared.seatsOf', { used: plan.members.length, seats: plan.seats })}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-ink/[0.10] bg-ink/[0.03] p-3">
        <span
          className="selectable rounded-[11px] border border-ink/[0.12] bg-ink/[0.04] px-3.5 py-2 font-mono text-[16px] tracking-[0.16em] text-ink"
          style={{ boxShadow: 'inset 0 0 24px -12px var(--color-accent-glow)' }}
        >
          {plan.invite_code}
        </span>
        <PrimaryBtn onClick={copy}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? t('starpass.shared.invite.copied') : t('starpass.shared.invite.copy')}
        </PrimaryBtn>
        <LinkBtn onClick={() => !regenerate.isPending && regenerate.mutate()}>
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw size={12} className={regenerate.isPending ? 'animate-spin' : undefined} />
            {t('starpass.shared.invite.regenerate')}
          </span>
        </LinkBtn>
      </div>

      <div className="mt-3 flex flex-col gap-2">
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
