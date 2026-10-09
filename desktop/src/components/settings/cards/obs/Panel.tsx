import type { ReactNode } from 'react';
import { Toggle } from '../../primitives';

export function Panel({
  icon,
  title,
  desc,
  checked,
  onToggle,
  children,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  checked: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 transition-[border-color,box-shadow] duration-500"
      style={{
        border: `0.5px solid ${checked ? 'var(--color-accent-glow)' : 'rgba(255,255,255,0.06)'}`,
        background:
          'radial-gradient(120% 90% at 0% 0%, var(--color-accent-glow), transparent 55%), rgba(255,255,255,0.02)',
        boxShadow: checked ? '0 10px 32px rgba(0,0,0,0.25)' : undefined,
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.05] text-white/70">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-bold tracking-tight text-white/90">{title}</p>
            <p className="text-[11.5px] leading-snug text-white/35">{desc}</p>
          </div>
        </div>
        <Toggle checked={checked} onChange={onToggle} />
      </div>
      {checked && children && <div className="mt-4 space-y-4">{children}</div>}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
      {children}
    </p>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[11.5px] leading-snug text-white/30">{children}</p>;
}
