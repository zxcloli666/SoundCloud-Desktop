import type { ReactNode } from 'react';

export function LinkOption({
  icon,
  title,
  desc,
  trailing,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  trailing: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/opt flex w-full cursor-pointer items-center gap-3 rounded-[12px] border border-[color:var(--set-line)] bg-[var(--set-well)] px-3.5 py-3 text-left transition-colors duration-150 hover:border-[color:var(--shell-line-hi)] hover:bg-[var(--set-well-hi)]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--set-well)] text-[var(--color-accent)] [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink-90">{title}</span>
        <span className="mt-0.5 block truncate text-[11.5px] text-ink-45">{desc}</span>
      </span>
      <span className="shrink-0 text-ink-35 transition-colors duration-150 group-hover/opt:text-ink-80">
        {trailing}
      </span>
    </button>
  );
}
