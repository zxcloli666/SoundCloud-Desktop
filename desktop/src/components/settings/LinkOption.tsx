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
      className="group/opt flex items-center gap-3.5 w-full text-left rounded-2xl px-4 py-3.5 bg-ink/[0.03] hover:bg-ink/[0.06] border border-ink/[0.06] hover:border-[var(--color-accent-glow)] transition-all duration-300 ease-[var(--ease-apple)] active:scale-[0.985] cursor-pointer"
    >
      <span
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[var(--color-accent)] transition-transform duration-300 ease-[var(--ease-apple)] group-hover/opt:scale-110"
        style={{
          background: 'linear-gradient(135deg, var(--color-accent-glow), rgb(var(--ink) / 0.03))',
          border: '0.5px solid var(--color-accent-glow)',
        }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-ink-85">{title}</span>
        <span className="block text-[11.5px] text-ink-40 mt-0.5 leading-snug">{desc}</span>
      </span>
      <span className="shrink-0 text-ink-30 group-hover/opt:text-[var(--color-accent)] transition-colors duration-300">
        {trailing}
      </span>
    </button>
  );
}
