import { memo } from 'react';
import { type Aura, auraRgba } from '../../lib/aura';
import {usePerfMode} from '../../lib/perf';

export interface FilterOption<T extends string> {
  id: T;
  label: string;
  count?: number;
}

interface FilterRowProps<T extends string> {
  options: ReadonlyArray<FilterOption<T>>;
  active: T;
  onChange: (id: T) => void;
  aura: Aura;
  size?: 'sm' | 'md';
}

function FilterRowImpl<T extends string>({
  options,
  active,
  onChange,
  aura,
  size = 'md',
}: FilterRowProps<T>) {
    const perf = usePerfMode();
    const b = perf.blur(20);
  const padX = size === 'sm' ? 'px-3' : 'px-4';
  const padY = size === 'sm' ? 'h-7' : 'h-8';
  const fontSize = size === 'sm' ? 'text-[10.5px]' : 'text-[11.5px]';

  return (
    <div
      className="inline-flex items-center gap-1 p-1 rounded-2xl flex-wrap"
      style={{
          background: b > 0 ? 'rgb(var(--ink) / 0.03)' : 'rgb(var(--surface-hi) / 0.9)',
        border: '0.5px solid rgb(var(--ink) / 0.06)',
          backdropFilter: b > 0 ? `blur(${b}px)` : undefined,
          WebkitBackdropFilter: b > 0 ? `blur(${b}px)` : undefined,
      }}
    >
      {options.map((opt) => {
        const isActive = opt.id === active;
        return (
          <button
            key={opt.id}
            type="button"
            data-ui="chip"
            data-active={isActive}
            onClick={() => onChange(opt.id)}
            className={`inline-flex items-center gap-1.5 ${padX} ${padY} rounded-xl ${fontSize} font-semibold cursor-pointer transition-colors duration-300 ${
              isActive ? 'text-ink' : 'text-ink-45 hover:text-ink-80'
            }`}
            style={
              isActive
                ? {
                    background: `linear-gradient(180deg, ${auraRgba(aura, 0.22)}, ${auraRgba(aura, 0.06)})`,
                    boxShadow: `inset 0 0 0 1px ${auraRgba(aura, 0.35)}, inset 0 0.5px 0 rgba(255,255,255,0.12)`,
                  }
                : undefined
            }
          >
            <span>{opt.label}</span>
            {opt.count != null && (
              <span
                className="text-[9px] tabular-nums font-bold px-1.5 py-0.5 rounded-md"
                style={{
                  background: isActive ? 'rgb(var(--ink) / 0.18)' : 'rgb(var(--ink) / 0.05)',
                  color: isActive ? 'rgb(var(--ink))' : 'rgb(var(--ink) / calc(0.35 * (1 + var(--ink-lift) * (1 - 0.35))))',
                }}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const FilterRow = memo(FilterRowImpl) as typeof FilterRowImpl;
