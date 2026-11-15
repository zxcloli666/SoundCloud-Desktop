import { memo } from 'react';
import { Check } from '../../../../lib/icons';

export const Switch = memo(function Switch({
  on,
  disabled = false,
  onChange,
  label,
}: {
  on: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="relative h-[26px] w-[46px] shrink-0 cursor-pointer rounded-full transition-colors duration-300 disabled:cursor-default disabled:opacity-45"
      style={{ background: on ? 'var(--color-accent)' : 'rgb(var(--ink) / 0.14)' }}
    >
      <span
        className="absolute left-[3px] top-[3px] grid size-5 place-items-center rounded-full bg-paper transition-transform duration-300 ease-[var(--ease-apple)]"
        style={{ transform: `translateX(${on ? 20 : 0}px)` }}
      >
        <Check
          size={11}
          strokeWidth={3.4}
          className="text-accent transition-opacity duration-200"
          style={{ opacity: on ? 1 : 0 }}
        />
      </span>
    </button>
  );
});
