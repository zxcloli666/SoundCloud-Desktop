import { type KeyboardEvent, memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from '../../../../lib/icons';
import { accentInk, COVER_ACCENTS } from './perks';

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

export const AccentSwatches = memo(function AccentSwatches({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (accent: number) => void;
}) {
  const { t } = useTranslation();
  const dots = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = STEP[event.key];
    if (step === undefined || disabled) return;
    event.preventDefault();
    const to = (value + step + COVER_ACCENTS.length) % COVER_ACCENTS.length;
    onChange(to);
    dots.current[to]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={t('chat.room.perks.cover.accent')}
      aria-disabled={disabled}
      onKeyDown={onKeyDown}
      className={`perk-motion flex items-center justify-between px-1.5 transition-opacity duration-200 ${
        disabled ? 'opacity-35' : ''
      }`}
    >
      {COVER_ACCENTS.map((color, index) => {
        const on = index === value;
        return (
          <button
            key={color}
            ref={(node) => {
              dots.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={t('chat.room.perks.cover.accentN', { value: index + 1 })}
            tabIndex={on && !disabled ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(index)}
            className="perk-motion flex size-6 cursor-pointer items-center justify-center rounded-full outline-none transition-transform duration-200 enabled:hover:scale-110 disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-[5px] focus-visible:outline-ink"
            style={{
              background: color,
              color: accentInk(index),
              boxShadow: on ? `0 0 0 2px rgb(var(--surface)), 0 0 0 3.5px ${color}` : undefined,
              transform: on ? 'scale(1.08)' : undefined,
            }}
          >
            {on && <Check size={12} strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
});
