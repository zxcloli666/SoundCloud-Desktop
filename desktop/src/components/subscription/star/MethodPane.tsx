import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from '../../../lib/icons';
import { ProviderGlyph } from '../ProviderGlyph';
import type { ActivationOption } from '../providers';
import { PrimaryBtn, Ttl } from './StarConsole';

/** Method select — five payment routes; recurring toggle only when supported. */
export const MethodPane = memo(function MethodPane({
  options,
  selected,
  onSelect,
  canRecur,
  recurring,
  onRecurring,
  amount,
  pending,
  error,
  onContinue,
}: {
  options: ActivationOption[];
  selected: ActivationOption | null;
  onSelect: (o: ActivationOption) => void;
  canRecur: boolean;
  recurring: boolean;
  onRecurring: (v: boolean) => void;
  amount: string;
  pending: boolean;
  error: boolean;
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <Ttl>{t('starpass.providerSub')}</Ttl>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((opt) => {
          const on = opt.kind === selected?.kind;
          return (
            <button
              key={opt.kind}
              type="button"
              onClick={() => onSelect(opt)}
              className="cursor-pointer rounded-[13px] border p-3 text-left transition-all duration-200 ease-[var(--ease-apple)] hover:-translate-y-0.5"
              style={{
                borderColor: on
                  ? 'color-mix(in srgb, var(--color-accent) 60%, transparent)'
                  : 'rgb(var(--ink) / 0.10)',
                background: 'rgb(var(--ink) / 0.025)',
                boxShadow: on
                  ? '0 0 24px -8px var(--color-accent-glow), inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 35%, transparent)'
                  : undefined,
              }}
            >
              <span className="mb-2.5 grid size-[30px] place-items-center rounded-[9px] border border-ink/[0.08] bg-ink/[0.04]">
                <ProviderGlyph kind={opt.kind} />
              </span>
              <div className="text-[12.5px] font-semibold text-ink-90">
                {t(`starpass.method.${opt.i18n}.title`)}
              </div>
              <div className="mt-0.5 font-mono text-[9px] tracking-[0.06em] text-ink-40">
                {opt.tag}
              </div>
            </button>
          );
        })}
      </div>

      {/* recurring — only for methods that support it (custom checkbox) */}
      {canRecur && (
        <button
          type="button"
          role="checkbox"
          aria-checked={recurring}
          onClick={() => onRecurring(!recurring)}
          className="mt-3.5 flex w-fit cursor-pointer items-center gap-3 rounded-[12px] border border-ink/[0.10] bg-ink/[0.03] px-3.5 py-2.5 text-left transition-colors hover:bg-ink/[0.05]"
        >
          <span
            className="grid size-[19px] shrink-0 place-items-center rounded-[6px] border transition-all duration-200"
            style={{
              borderColor: recurring ? 'var(--color-accent)' : 'rgb(var(--ink) / 0.22)',
              background: recurring ? 'var(--color-accent)' : 'transparent',
              boxShadow: recurring ? '0 0 14px -3px var(--color-accent-glow)' : undefined,
            }}
          >
            {recurring && <Check size={12} strokeWidth={3.2} className="text-accent-contrast" />}
          </span>
          <span>
            <span className="block text-[12.5px] font-medium text-ink-85">
              {t('starpass.recurring')}
            </span>
            <span className="block text-[11px] text-ink-40">{t('starpass.recurringSub')}</span>
          </span>
        </button>
      )}

      <div className="mt-[18px] flex flex-wrap items-center gap-3">
        <PrimaryBtn onClick={onContinue} disabled={!selected || pending}>
          {pending ? t('starpass.creating') : `${t('starpass.continue')} · ${amount}`}
        </PrimaryBtn>
        {error && (
          <span className="text-[12.5px] text-red-300/95">{t('starpass.checkoutError')}</span>
        )}
      </div>
    </div>
  );
});
