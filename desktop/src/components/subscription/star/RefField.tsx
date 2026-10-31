import { useMutation } from '@tanstack/react-query';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from '../../../lib/icons';
import { payApi, payErrorCode } from '../../../lib/pay-client';
import { LinkBtn } from './StarConsole';

export type RefBonus = { code: string; days: number } | null;

const ERRORS: Record<string, string> = {
  ref_unknown: 'starpass.ref.unknown',
  ref_own: 'starpass.ref.own',
  ref_not_first: 'starpass.ref.notFirst',
};

/** A friend's invite code: checked before checkout so the bonus is certain, not hoped for. */
export const RefField = memo(function RefField({
  value,
  onChange,
}: {
  value: RefBonus;
  onChange: (next: RefBonus) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const check = useMutation({
    mutationFn: (code: string) => payApi.checkRef(code),
    onSuccess: (r, code) => onChange({ code, days: r.bonus_days }),
  });

  if (value) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/[0.12] bg-ink/[0.05] px-3 py-1.5 font-mono text-[11px] text-ink-80">
        <Check size={12} className="text-accent" />
        {t('starpass.ref.applied', { days: value.days })}
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-1 cursor-pointer text-ink-35 hover:text-ink-80"
        >
          ×
        </button>
      </span>
    );
  }

  if (!open) return <LinkBtn onClick={() => setOpen(true)}>{t('starpass.ref.have')}</LinkBtn>;

  const code = draft.trim();
  const error = check.isError
    ? (ERRORS[payErrorCode(check.error) ?? ''] ?? 'starpass.ref.failed')
    : null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value.toUpperCase());
            check.reset();
          }}
          onKeyDown={(e) => e.key === 'Enter' && code && check.mutate(code)}
          placeholder={t('starpass.ref.placeholder')}
          maxLength={16}
          className="w-[150px] rounded-[10px] border border-ink/[0.12] bg-ink/[0.04] px-3 py-2 font-mono text-[12.5px] tracking-[0.14em] text-ink outline-none placeholder:tracking-normal placeholder:text-ink-30 focus:border-ink/25"
        />
        <button
          type="button"
          disabled={!code || check.isPending}
          onClick={() => check.mutate(code)}
          className="cursor-pointer rounded-[10px] border border-ink/[0.12] bg-ink/[0.06] px-3 py-2 text-[12px] font-semibold text-ink-80 transition-colors hover:bg-ink/[0.1] disabled:cursor-default disabled:opacity-40"
        >
          {t('starpass.ref.apply')}
        </button>
      </div>
      {error && <span className="text-[11.5px] text-red-200/85">{t(error)}</span>}
    </div>
  );
});
