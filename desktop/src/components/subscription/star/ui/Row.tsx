import { memo, type ReactNode } from 'react';

const SUB_TONE = { plain: 'text-ink-45', warn: 'text-amber-400', bad: 'text-bad' } as const;

export const Row = memo(function Row({
  icon,
  title,
  sub,
  tone = 'plain',
  ui,
  children,
}: {
  icon?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  tone?: keyof typeof SUB_TONE;
  ui?: string;
  children?: ReactNode;
}) {
  return (
    <div data-ui={ui} className="flex min-h-[60px] items-center gap-3 px-4 py-3">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold text-ink-90">{title}</div>
        {sub && <div className={`mt-0.5 text-[12px] leading-snug ${SUB_TONE[tone]}`}>{sub}</div>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
});

export const IconTile = memo(function IconTile({
  on = true,
  children,
}: {
  on?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className="grid size-9 shrink-0 place-items-center rounded-[11px]"
      style={{
        background: on
          ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)'
          : 'rgb(var(--ink) / 0.06)',
        color: on ? 'var(--color-accent)' : 'rgb(var(--ink) / 0.45)',
      }}
    >
      {children}
    </span>
  );
});
