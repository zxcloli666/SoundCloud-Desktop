import { useQuery } from '@tanstack/react-query';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from '../../../lib/icons';
import { payApi } from '../../../lib/pay-client';
import { Ttl } from './StarConsole';

export const REFERRAL_KEY = ['pay', 'referral'] as const;

/** Your invite code: a friend's first STAR brings both of you extra days. */
export const InvitePane = memo(function InvitePane() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: REFERRAL_KEY,
    queryFn: payApi.referral,
    staleTime: 60_000,
  });
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return <div className="font-mono text-[12px] text-white/40">{t('starpass.loading')}</div>;
  }
  if (isError || !data) {
    return <p className="text-[13px] text-red-200/90">{t('starpass.loadError')}</p>;
  }

  const copy = () => {
    void navigator.clipboard
      .writeText(t('starpass.invite.shareText', { code: data.code, days: data.bonus_days }))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
  };

  return (
    <div>
      <Ttl>{t('starpass.invite.title', { days: data.bonus_days })}</Ttl>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="selectable rounded-[12px] border border-white/[0.12] bg-white/[0.04] px-4 py-2.5 font-mono text-[20px] tracking-[0.22em] text-white"
          style={{ boxShadow: 'inset 0 0 24px -12px var(--color-accent-glow)' }}
        >
          {data.code}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex cursor-pointer items-center gap-2 rounded-[13px] px-5 py-3 text-[13px] font-semibold text-accent-contrast transition-transform duration-200 hover:-translate-y-px"
          style={{
            background: 'linear-gradient(180deg, var(--color-accent-hover), var(--color-accent))',
            boxShadow:
              '0 0 30px -8px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.4)',
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? t('starpass.gift.copied') : t('starpass.invite.copy')}
        </button>
      </div>

      <div className="mt-4 flex gap-1">
        {Array.from({ length: data.cap }, (_, i) => (
          <span
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{
              background: i < data.invited ? 'var(--color-accent)' : 'rgba(255,255,255,0.07)',
              boxShadow: i < data.invited ? '0 0 8px var(--color-accent-glow)' : undefined,
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10.5px] text-white/40">
        <span>{t('starpass.invite.friends', { count: data.invited, cap: data.cap })}</span>
        <span className="text-accent">
          {t('starpass.invite.earned', { count: data.days_earned })}
        </span>
      </div>
    </div>
  );
});
