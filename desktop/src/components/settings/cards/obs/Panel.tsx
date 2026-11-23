import type { ReactNode } from 'react';
import { Toggle } from '../../primitives';

export function Panel({
  icon,
  title,
  desc,
  checked,
  onToggle,
  children,
  'data-ui': dataUi,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  checked: boolean;
  onToggle: () => void;
  children?: ReactNode;
  'data-ui'?: string;
}) {
  return (
    <div
      data-ui={dataUi}
      className="relative overflow-hidden rounded-[12px] bg-[var(--set-well)] p-3.5"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex size-8 shrink-0 items-center justify-center rounded-[9px] transition-colors duration-150 ${
              checked ? 'bg-accent/[0.12] text-[var(--color-accent)]' : 'bg-ink/[0.05] text-ink-55'
            }`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium text-ink-90">{title}</p>
            <p className="text-[12px] leading-snug text-ink-45">{desc}</p>
          </div>
        </div>
        <Toggle checked={checked} onChange={onToggle} label={title} />
      </div>
      {checked && children && <div className="mt-4 space-y-4">{children}</div>}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] font-medium text-ink-70">{children}</p>;
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[12px] leading-snug text-ink-45">{children}</p>;
}
