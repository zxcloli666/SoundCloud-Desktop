import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Gift } from '../../../lib/icons';
import { monthsKey } from './meta';

/** A gift code as a torn-off ticket: plan, the code itself, one tap to copy. */
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
  const [copied, setCopied] = useState(false);
  const months = Math.max(1, Math.round(periodDays / 30));

  const copy = () => {
    void navigator.clipboard.writeText(t('starpass.gift.shareText', { code })).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div
      className="relative flex items-stretch overflow-hidden rounded-[14px] border border-ink/[0.10]"
      style={{
        background: redeemed
          ? 'rgb(var(--ink) / 0.025)'
          : 'linear-gradient(110deg, color-mix(in srgb, var(--color-accent) 16%, transparent), rgb(var(--ink) / 0.02) 55%)',
        opacity: redeemed ? 0.55 : 1,
      }}
    >
      <div className="flex w-[74px] shrink-0 flex-col items-center justify-center gap-1 border-r border-dashed border-ink/15 py-3">
        <Gift size={18} className="text-accent" />
        <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-50">
          {t(`starpass.plan.${monthsKey(months)}`)}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3">
        <span
          className="selectable truncate font-mono text-[14px] tracking-[0.08em] text-ink-90"
          style={{ textDecoration: redeemed ? 'line-through' : undefined }}
        >
          {code}
        </span>
        {redeemed ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
            {t('starpass.gift.redeemed')}
          </span>
        ) : (
          <button
            type="button"
            onClick={copy}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-ink/[0.12] bg-ink/[0.05] px-3 py-1.5 text-[11.5px] font-semibold text-ink-80 transition-colors hover:bg-ink/[0.1] hover:text-ink"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? t('starpass.gift.copied') : t('starpass.gift.copy')}
          </button>
        )}
      </div>
    </div>
  );
});
