import type { ReactNode } from 'react';

export function Block({
  icon,
  title,
  desc,
  control,
  children,
  'data-ui': mark,
}: {
  icon: ReactNode;
  title: ReactNode;
  desc?: ReactNode;
  control?: ReactNode;
  children?: ReactNode;
  'data-ui'?: string;
}) {
  return (
    <div data-ui={mark} className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-ink/[0.06] bg-ink/[0.04] text-ink-55">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-medium text-ink-80">{title}</span>
          {desc && (
            <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-40">{desc}</span>
          )}
        </span>
        {control && <span className="flex shrink-0 items-center gap-2">{control}</span>}
      </div>
      {children && <div className="mt-3 pl-11">{children}</div>}
    </div>
  );
}

export function Pill({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'bad' | 'muted' | 'accent';
  children: ReactNode;
}) {
  const cls = {
    ok: 'bg-ok/10 text-ok border-ok/20',
    warn: 'bg-amber-400/10 text-amber-300 border-amber-400/25',
    bad: 'bg-bad/10 text-bad border-bad/20',
    muted: 'bg-ink/[0.05] text-ink-55 border-ink/[0.08]',
    accent: 'bg-accent/12 text-accent border-accent/25',
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${cls}`}
    >
      {children}
    </span>
  );
}

export function Empty({
  icon,
  text,
  action,
}: {
  icon: ReactNode;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-ink/[0.07] bg-ink/[0.03] text-ink-30">
        {icon}
      </div>
      <p className="text-[12.5px] text-ink-45">{text}</p>
      {action}
    </div>
  );
}

export function SmallButton({
  onClick,
  children,
  primary = false,
  danger = false,
  disabled = false,
  label,
}: {
  onClick: () => void;
  children: ReactNode;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const tone = primary
    ? 'text-accent-contrast'
    : danger
      ? 'border border-bad/25 bg-bad/10 text-bad hover:bg-bad/15'
      : 'border border-ink/[0.08] bg-ink/[0.06] text-ink-75 hover:bg-ink/[0.1] hover:border-ink/[0.12]';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3.5 text-[12px] font-semibold transition-all duration-300 ease-[var(--ease-apple)] hover:-translate-y-px active:scale-[0.97] disabled:cursor-default disabled:opacity-40 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${tone}`}
      style={
        primary
          ? {
              background: 'linear-gradient(180deg, var(--color-accent-hover), var(--color-accent))',
              boxShadow:
                '0 8px 22px -8px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.3)',
            }
          : undefined
      }
    >
      {children}
    </button>
  );
}
