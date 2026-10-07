import React from 'react';

export const ActionTile = React.memo(function ActionTile({
  icon,
  title,
  subtitle,
  badge,
  hint,
  footnote,
  accent = false,
  disabled = false,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
  hint?: string;
  footnote?: React.ReactNode;
  accent?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full cursor-pointer items-start gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.025] px-3 py-3 text-left transition-all duration-200 ease-[var(--ease-apple)] hover:border-white/[0.12] hover:bg-white/[0.05] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-white/[0.06] disabled:hover:bg-white/[0.025] disabled:active:scale-100"
    >
      <span
        className={`flex size-9 flex-none items-center justify-center rounded-[11px] transition-colors ${
          accent
            ? 'bg-accent/15 text-accent'
            : 'bg-white/[0.05] text-white/70 group-hover:text-white/95'
        }`}
        style={accent ? { boxShadow: '0 0 18px var(--color-accent-glow)' } : undefined}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13px] font-semibold text-white/90">{title}</span>
          {badge && (
            <span className="ml-auto flex-none rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10.5px] font-semibold tabular-nums text-white/55">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-snug text-white/45">{subtitle}</span>
        {footnote && <span className="mt-1.5 block text-[10.5px] text-white/30">{footnote}</span>}
        {hint && <span className="mt-1.5 block text-[11px] text-amber-200/70">{hint}</span>}
      </span>
    </button>
  );
});
