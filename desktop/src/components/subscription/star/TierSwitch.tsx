import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TierId } from '../../../lib/pay-client';

export interface TierOption {
  id: TierId;
  people: number;
  each: number;
  savePct: number;
}

/** Personal / Duo / Family: who is covered, what each person pays, how much that saves. */
export const TierSwitch = memo(function TierSwitch({
  value,
  options,
  onChange,
}: {
  value: TierId;
  options: TierOption[];
  onChange: (next: TierId) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-3 grid grid-cols-3 gap-1.5 rounded-[14px] border border-ink/[0.10] bg-ink/[0.04] p-1.5">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className="cursor-pointer rounded-[10px] px-2 py-2.5 text-center transition-all duration-200"
            style={{
              background: on
                ? 'linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 28%, transparent), transparent), rgb(var(--ink) / 0.06)'
                : undefined,
              boxShadow: on
                ? '0 0 18px -4px var(--color-accent-glow), inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 45%, transparent)'
                : undefined,
            }}
          >
            <span
              className="block text-[13px] font-semibold"
              style={{ color: on ? 'rgb(var(--ink))' : 'rgb(var(--ink) / 0.6)' }}
            >
              {t(`starpass.tier.${o.id}`)}
            </span>
            <span className="mt-0.5 block font-mono text-[9.5px] text-ink-45">
              {t('starpass.tier.people', { count: o.people })}
            </span>
            <span className="mt-1 flex items-center justify-center gap-1.5 font-mono text-[9.5px]">
              {o.each > 0 && (
                <span className="text-ink-60">
                  {t(o.people > 1 ? 'starpass.tier.each' : 'starpass.tier.price', {
                    price: o.each,
                  })}
                </span>
              )}
              {o.savePct > 0 && (
                <span className="font-semibold text-accent">
                  {t('starpass.tier.save', { pct: o.savePct })}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
});
