import { useQuery } from '@tanstack/react-query';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { payApi } from '../../../../lib/pay-client';
import { AccentSpinner } from '../AccentSpinner';
import { REFERRAL_KEY } from '../flow/keys';
import { CodeChip } from '../ui/CodeChip';
import { CopyBtn } from '../ui/CopyBtn';
import { Title } from '../ui/Panel';

export const InviteStep = memo(function InviteStep() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: REFERRAL_KEY,
    queryFn: payApi.referral,
    staleTime: 60_000,
  });
  if (isLoading) return <AccentSpinner />;
  if (isError || !data) return <p className="text-[13px] text-bad">{t('starpass.loadError')}</p>;
  return (
    <div data-ui="star-invite">
      <Title>{t('starpass.invite.title', { days: data.bonus_days })}</Title>
      <div className="flex flex-wrap items-center gap-2.5">
        <CodeChip code={data.code} big />
        <CopyBtn
          text={t('starpass.invite.shareText', { code: data.code, days: data.bonus_days })}
          label={t('starpass.invite.copy')}
        />
      </div>
      <div className="mt-5 flex gap-1">
        {Array.from({ length: data.cap }, (_, i) => (
          <span
            key={i}
            className="h-2 flex-1 rounded-full"
            style={{
              background: i < data.invited ? 'var(--color-accent)' : 'rgb(var(--ink) / 0.08)',
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[12px] tabular-nums text-ink-50">
        <span>{t('starpass.invite.friends', { count: data.invited, cap: data.cap })}</span>
        <span className="font-bold text-accent">
          {t('starpass.invite.earned', { count: data.days_earned })}
        </span>
      </div>
    </div>
  );
});
