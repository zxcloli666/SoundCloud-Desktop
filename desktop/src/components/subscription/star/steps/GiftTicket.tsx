import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Gift } from '../../../../lib/icons';
import { monthsKey } from '../meta';
import { CopyBtn } from '../ui/CopyBtn';

export const GiftTicket = memo(function GiftTicket({
  code,
  periodDays,
  redeemed = false,
}: {
  code: string;
  periodDays: number;
  redeemed?: boolean;
}) {
  const { t } = useTranslation();
  const months = Math.max(1, Math.round(periodDays / 30));
  return (
    <div
      data-ui="star-gift-ticket"
      data-redeemed={redeemed || undefined}
      className={`relative flex items-stretch overflow-hidden rounded-[16px] border border-ink/[0.09] ${redeemed ? 'bg-ink/[0.03] opacity-60' : 'bg-accent/[0.07]'}`}
    >
      <div className="flex w-[78px] shrink-0 flex-col items-center justify-center gap-1 border-r border-dashed border-ink/15 py-3">
        <Gift size={18} className="text-accent" />
        <span className="text-[11px] font-semibold text-ink-55">
          {t(`starpass.plan.${monthsKey(months)}`)}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3">
        <span
          className="selectable truncate font-mono text-[13.5px] font-semibold tracking-[0.04em] text-ink-90"
          style={{ textDecoration: redeemed ? 'line-through' : undefined }}
        >
          {code}
        </span>
        {redeemed ? (
          <span className="shrink-0 text-[12px] font-semibold text-ink-45">
            {t('starpass.gift.redeemed')}
          </span>
        ) : (
          <CopyBtn
            text={t('starpass.gift.shareText', { code })}
            label={t('starpass.gift.copy')}
            tone="ghost"
            size="sm"
          />
        )}
      </div>
    </div>
  );
});
