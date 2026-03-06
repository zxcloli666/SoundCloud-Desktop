import type React from 'react';
import { toCompactCount } from '../../lib/utils.ts';

export type SegmentedTabItem<T extends string = string> = {
  id: T;
  label: React.ReactNode;
  count?: number | null;
  disabled?: boolean;
};

export type SegmentedTabsProps<T extends string = string> = {
  items: SegmentedTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  align?: 'start' | 'center';
  className?: string;
};

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  align = 'start',
  className = '',
}: SegmentedTabsProps<T>) {
  const alignClass = align === 'center' ? 'justify-center' : 'justify-start';

  return (
    <div className={`w-full flex ${alignClass} ${className}`}>
      <div className="flex w-fit items-center gap-1.5 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-1.5 shadow-lg backdrop-blur-2xl">
        {items.map((tab) => {
          const isActive = value === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-300 ease-[var(--ease-apple)] ${
                isActive
                  ? 'bg-white/[0.12] text-white shadow-md border border-white/[0.05]'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04] border border-transparent'
              } ${tab.disabled ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
            >
              {tab.label}
              {tab.count != null && (
                <span
                  className={`text-[11px] tabular-nums px-2 py-0.5 rounded-full transition-colors ${
                    isActive ? 'bg-white/20 text-white' : 'bg-white/5 text-white/30'
                  }`}
                >
                  {toCompactCount(tab.count)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
