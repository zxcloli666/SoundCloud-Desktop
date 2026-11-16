import type { ReactNode } from 'react';

export const PILL_ROW =
  'flex items-center gap-0.5 p-0.5 rounded-full bg-ink/[0.04] border border-ink/10';

export interface PillTab<T extends string> {
  id: T;
  icon: ReactNode;
  label: string;
  title?: string;
}

export function PillTabs<T extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: PillTab<T>[];
  active: T;
  onSelect: (id: T) => void;
}) {
  return tabs.map(({ id, icon, label, title }) => (
    <button
      key={id}
      type="button"
      role="tab"
      data-ui="tab"
      aria-selected={active === id}
      onClick={() => onSelect(id)}
      title={title}
      className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[12px] font-medium transition-all duration-300 cursor-pointer"
      style={
        active === id
          ? {
              color: 'rgb(var(--ink))',
              background:
                'linear-gradient(180deg, var(--color-accent-glow), transparent), rgb(var(--ink) / 0.04)',
              boxShadow:
                '0 0 16px var(--color-accent-glow), inset 0 0.5px 0 rgba(255,255,255,0.12)',
            }
          : { color: 'rgb(var(--ink) / calc(0.45 * (1 + var(--ink-lift) * (1 - 0.45))))' }
      }
    >
      {icon}
      {label}
    </button>
  ));
}
