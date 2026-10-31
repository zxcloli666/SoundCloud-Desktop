import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Gift, Star } from '../../../lib/icons';
import type { Recipient } from './meta';

const OPTIONS = [
  { id: 'self', Icon: Star },
  { id: 'gift', Icon: Gift },
] as const;

export const RecipientSwitch = memo(function RecipientSwitch({
  value,
  onChange,
}: {
  value: Recipient;
  onChange: (next: Recipient) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-3 inline-flex gap-1 rounded-full border border-ink/[0.10] bg-ink/[0.03] p-1">
      {OPTIONS.map(({ id, Icon }) => {
        const on = id === value;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-all duration-200"
            style={{
              color: on ? 'rgb(var(--ink))' : 'rgb(var(--ink) / 0.45)',
              background: on
                ? 'color-mix(in srgb, var(--color-accent) 24%, transparent)'
                : undefined,
              boxShadow: on
                ? 'inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 45%, transparent)'
                : undefined,
            }}
          >
            <Icon size={12} className={on ? 'text-accent' : undefined} />
            {t(`starpass.recipient.${id}`)}
          </button>
        );
      })}
    </div>
  );
});
