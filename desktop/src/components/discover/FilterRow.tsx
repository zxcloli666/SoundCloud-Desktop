import { memo } from 'react';
import { fc } from '../../lib/formatters';

export interface FilterOption<T extends string> {
  id: T;
  label: string;
  count?: number;
}

interface FilterRowProps<T extends string> {
  options: ReadonlyArray<FilterOption<T>>;
  active: T;
  onChange: (id: T) => void;
  wrap?: boolean;
}

function FilterRowImpl<T extends string>({
  options,
  active,
  onChange,
  wrap = false,
}: FilterRowProps<T>) {
  return (
    <div
      role="radiogroup"
      className={
        wrap
          ? 'flex flex-wrap items-center gap-1.5'
          : 'chip-group w-fit max-w-full overflow-x-auto [scrollbar-width:none]'
      }
    >
      {options.map((option) => {
        const on = option.id === active;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={on}
            data-ui="chip"
            data-active={on}
            data-on={on || undefined}
            onClick={() => onChange(option.id)}
            className={wrap ? 'chip-toggle' : 'chip-seg shrink-0 whitespace-nowrap'}
          >
            <span>{option.label}</span>
            {option.count != null && (
              <span className={`text-[10px] tabular-nums ${on ? 'text-ink-50' : 'text-ink-30'}`}>
                {fc(option.count)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const FilterRow = memo(FilterRowImpl) as typeof FilterRowImpl;
