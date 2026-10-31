import { memo, type ReactNode } from 'react';

/** Shared shell + button vocabulary for the STAR console (one visual language). */

/** Floating glass console that houses the per-state panes over the living core. */
export const Console = memo(function Console({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative rounded-[22px] border border-ink/[0.10] p-5 md:p-[22px]"
      style={{
        background:
          'linear-gradient(180deg, rgb(var(--ink) / 0.05), rgb(var(--ink) / 0.012) 60%), rgb(var(--surface) / 0.72)',
        backdropFilter: 'blur(26px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(26px) saturate(1.5)',
        boxShadow: '0 30px 90px -30px rgb(var(--shade) / calc(0.9 * var(--shade-alpha))), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      <span
        aria-hidden
        className="absolute inset-x-6 top-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgb(var(--ink) / 0.4), transparent)',
        }}
      />
      {children}
    </div>
  );
});

export const PrimaryBtn = memo(function PrimaryBtn({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex cursor-pointer items-center gap-2 rounded-[13px] px-6 py-3.5 text-[13.5px] font-semibold text-accent-contrast transition-transform duration-200 ease-[var(--ease-apple)] hover:-translate-y-px disabled:cursor-default disabled:opacity-50"
      style={{
        background: 'linear-gradient(180deg, var(--color-accent-hover), var(--color-accent))',
        boxShadow: '0 0 36px -8px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.4)',
      }}
    >
      {children}
    </button>
  );
});

export const GhostBtn = memo(function GhostBtn({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-2 rounded-[13px] border border-ink/[0.10] bg-ink/[0.05] px-5 py-3.5 text-[13.5px] font-semibold text-ink-80 transition-colors hover:bg-ink/[0.09] hover:text-ink"
    >
      {children}
    </button>
  );
});

export const LinkBtn = memo(function LinkBtn({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer bg-transparent font-mono text-[11px] uppercase tracking-[0.12em] text-ink-40 transition-colors hover:text-ink-80"
    >
      {children}
    </button>
  );
});

export const Ttl = memo(function Ttl({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3.5 font-mono text-[10.5px] uppercase tracking-[0.2em] text-ink-40">
      {children}
    </div>
  );
});
