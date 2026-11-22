import type { ReactNode } from 'react';

export const PILL_ROW = 'chip-group';

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
      className="chip-seg"
    >
      {icon}
      {label}
    </button>
  ));
}
