import type { ReactNode } from 'react';

export interface ChoiceOption<T extends string> {
  id: T;
  label: string;
  icon: ReactNode;
}

export function Choice<T extends string>({
  value,
  options,
  onChange,
  label,
  'data-ui': ui,
}: {
  value: T;
  options: ReadonlyArray<ChoiceOption<T>>;
  onChange: (value: T) => void;
  label: string;
  'data-ui': string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-ui={ui}
      data-value={value}
      className="flex min-w-0 gap-0.5 rounded-xl bg-ink/[0.06] p-[3px]"
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.id)}
            className={`flex h-8 min-w-0 cursor-pointer items-center gap-1.5 rounded-[9px] px-3 text-[12px] font-semibold transition-colors duration-150 ${
              active
                ? 'bg-ink/[0.13] text-ink-95 [[data-scheme=white]_&]:bg-surface-hi [[data-scheme=white]_&]:shadow-sm'
                : 'text-ink-45 hover:text-ink-80'
            }`}
          >
            <span className={`shrink-0 ${active ? 'text-accent' : ''}`}>{option.icon}</span>
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
