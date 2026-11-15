import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from '../../../../lib/icons';
import type { MethodId } from '../../../../lib/pay-client';
import { tileOf } from '../../methods';
import { ON } from '../choose/styles';
import { MethodBadge } from './MethodBadge';

export const MethodChoice = memo(function MethodChoice({
  id,
  on,
  onPick,
}: {
  id: MethodId;
  on: boolean;
  onPick: (id: MethodId) => void;
}) {
  const { t } = useTranslation();
  const tile = tileOf(id);
  return (
    <button
      type="button"
      aria-pressed={on}
      data-method={id}
      onClick={() => onPick(id)}
      className="flex cursor-pointer items-center gap-3 rounded-[14px] px-2.5 py-2.5 text-left transition-[background-color,box-shadow] duration-200 hover:bg-ink/[0.05]"
      style={on ? ON : undefined}
    >
      <MethodBadge kind={id} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-ink-90">
          {t(`starpass.method.${tile.i18n}.title`)}
        </span>
        <span className="block truncate text-[11.5px] text-ink-45">
          {t(`starpass.method.${tile.i18n}.body`)}
        </span>
      </span>
      <span
        className="grid size-[18px] shrink-0 place-items-center rounded-full transition-colors duration-200"
        style={{
          boxShadow: on ? undefined : 'inset 0 0 0 1.5px rgb(var(--ink) / 0.2)',
          background: on ? 'var(--color-accent)' : undefined,
        }}
      >
        {on && <Check size={11} strokeWidth={3.4} className="text-accent-contrast" />}
      </span>
    </button>
  );
});
