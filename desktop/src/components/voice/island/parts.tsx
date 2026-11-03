import type { ReactNode } from 'react';
import { X } from '../../../lib/icons';

export type TileTone = 'accent' | 'ok' | 'bad' | 'muted';

const TILE: Record<TileTone, string> = {
  accent: 'bg-accent/15 text-accent',
  ok: 'bg-ok/12 text-ok',
  bad: 'bg-bad/12 text-bad',
  muted: 'bg-ink/[0.06] text-ink-55',
};

export function IconTile({ tone, children }: { tone: TileTone; children: ReactNode }) {
  return (
    <span
      className={`flex size-10 shrink-0 items-center justify-center rounded-[14px] ${TILE[tone]}`}
    >
      {children}
    </span>
  );
}

export function IslandText({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[13px] font-semibold leading-tight text-ink-90">
        {title}
      </span>
      {sub && (
        <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-ink-45">{sub}</span>
      )}
    </span>
  );
}

export function IslandAction({
  onClick,
  children,
  primary = false,
  label,
}: {
  onClick: () => void;
  children: ReactNode;
  primary?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`relative inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold transition-transform duration-300 ease-[var(--ease-apple)] hover:-translate-y-px active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${
        primary
          ? 'text-accent-contrast'
          : 'border border-ink/[0.1] bg-ink/[0.06] text-ink-80 hover:bg-ink/[0.1]'
      }`}
      style={
        primary
          ? {
              background: 'linear-gradient(180deg, var(--color-accent-hover), var(--color-accent))',
              boxShadow:
                '0 6px 18px -6px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.3)',
            }
          : undefined
      }
    >
      {children}
    </button>
  );
}

export function CloseX({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-40 transition-colors duration-200 hover:bg-ink/[0.08] hover:text-ink-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
    >
      <X size={14} />
    </button>
  );
}

export function Dots() {
  return (
    <span aria-hidden className="inline-flex items-center gap-[3px] align-middle">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1 rounded-full bg-current motion-reduce:animate-none"
          style={{ animation: `vx-dot 1.2s ease-in-out ${i * 0.16}s infinite` }}
        />
      ))}
    </span>
  );
}
