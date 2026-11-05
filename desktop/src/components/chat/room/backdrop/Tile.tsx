import { memo, type ReactNode } from 'react';
import { Check, Loader2 } from '../../../../lib/icons';

export interface TileProps {
  label: string;
  ui?: string;
  current: boolean;
  pending: boolean;
  disabled?: boolean;
  onPick: () => void;
  onFocus: () => void;
  children: ReactNode;
}

export const Tile = memo(function Tile({
  label,
  ui,
  current,
  pending,
  disabled,
  onPick,
  onFocus,
  children,
}: TileProps) {
  return (
    <button
      type="button"
      data-tile
      data-ui={ui}
      aria-label={label}
      aria-pressed={current}
      aria-busy={pending}
      aria-disabled={disabled}
      onClick={() => !disabled && onPick()}
      onFocus={onFocus}
      onMouseEnter={onFocus}
      className={`group relative aspect-[16/10] cursor-pointer overflow-hidden rounded-xl text-left outline-none transition-[transform,box-shadow] duration-200 ease-[var(--ease-apple)] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.97] ${
        current
          ? 'ring-2 ring-accent shadow-[0_0_22px_-6px_var(--color-accent-glow)]'
          : 'ring-1 ring-ink/[0.08] hover:-translate-y-px hover:ring-ink/20'
      } ${disabled ? 'cursor-default opacity-60' : ''}`}
      style={{ isolation: 'isolate' }}
    >
      {children}
      {current && !pending && (
        <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-md">
          <Check size={11} strokeWidth={3} />
        </span>
      )}
      {pending && (
        <span
          data-scheme="dark"
          className="absolute inset-0 flex items-center justify-center bg-shade-30"
        >
          <Loader2 size={18} className="animate-spin text-ink" />
        </span>
      )}
    </button>
  );
});

export function TileLabel({ tone, children }: { tone: 'dark' | 'light'; children: ReactNode }) {
  return (
    <span
      data-scheme={tone === 'dark' ? 'dark' : 'white'}
      className="absolute inset-x-0 bottom-0 truncate px-2 pt-4 pb-1.5 text-[11px] font-semibold text-ink-90"
      style={{ background: 'linear-gradient(180deg, transparent, rgb(var(--paper) / 0.7))' }}
    >
      {children}
    </span>
  );
}
