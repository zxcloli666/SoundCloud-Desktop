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
    <div data-ui={mark} className="py-3.5">
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-[var(--set-well)] text-ink-55">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-medium text-ink-90">{title}</span>
          {desc && (
            <span className="mt-0.5 block text-[12px] leading-snug text-ink-45">{desc}</span>
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
    warn: 'bg-amber-400/10 text-amber-400 border-amber-400/25',
    bad: 'bg-bad/10 text-bad border-bad/20',
    muted: 'bg-ink/[0.05] text-ink-55 border-ink/[0.08]',
    accent: 'bg-accent/12 text-accent border-accent/25',
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}
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
      <div className="flex size-12 items-center justify-center rounded-[14px] bg-[var(--set-well)] text-ink-40">
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
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="set-btn"
      data-tone={primary ? 'accent' : danger ? 'danger' : undefined}
    >
      {children}
    </button>
  );
}
