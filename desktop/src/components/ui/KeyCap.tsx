import type { ReactNode } from 'react';

const SIZES = {
  md: 'min-w-[28px] h-[28px] px-1.5 rounded-lg text-[12px]',
  sm: 'min-w-[24px] h-[24px] px-1.5 rounded-md text-[11px]',
};

export function KeyCap({
  children,
  size = 'md',
  active = false,
}: {
  children: ReactNode;
  size?: keyof typeof SIZES;
  active?: boolean;
}) {
  return (
    <kbd
      data-ui="kbd"
      className={`inline-flex items-center justify-center font-semibold font-mono border shadow-[0_1px_2px_rgb(var(--shade)/calc(0.3*var(--shade-alpha))),inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors duration-200 ${SIZES[size]} ${
        active
          ? 'bg-accent/[0.16] border-accent/40 text-ink-90'
          : 'bg-ink/[0.08] border-ink/[0.1] text-ink-70'
      }`}
    >
      {children}
    </kbd>
  );
}

export function KeyCaps({
  labels,
  size,
  active,
}: {
  labels: string[];
  size?: 'md' | 'sm';
  active?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {labels.map((label, i) => (
        <KeyCap key={`${label}-${i}`} size={size} active={active}>
          {label}
        </KeyCap>
      ))}
    </span>
  );
}
