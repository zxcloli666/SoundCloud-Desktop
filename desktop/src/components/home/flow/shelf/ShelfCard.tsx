import type { ReactNode } from 'react';

export const SHELF_CARD_WIDTH = 92;

interface Props {
  scrollKey: string;
  cover: string | null;
  title: string;
  subtitle?: string;
  round?: boolean;
  active?: boolean;
  dimmed?: boolean;
  coverLabel: string;
  onOpen: () => void;
  mark?: Record<string, string>;
  overlay?: ReactNode;
  action?: ReactNode;
}

export function ShelfCard({
  scrollKey,
  cover,
  title,
  subtitle,
  round,
  active,
  dimmed,
  coverLabel,
  onOpen,
  mark,
  overlay,
  action,
}: Props) {
  return (
    <div
      {...mark}
      data-ui="shelf-card"
      data-scroll-key={scrollKey}
      style={{ width: SHELF_CARD_WIDTH }}
      className="shrink-0"
    >
      <div className="relative">
        <button
          type="button"
          aria-label={coverLabel}
          onClick={onOpen}
          className={`group relative block aspect-square w-full cursor-pointer overflow-hidden bg-ink/[0.06] outline-none ring-1 transition-[box-shadow,opacity] focus-visible:ring-2 focus-visible:ring-accent/70 ${
            round ? 'rounded-full' : 'rounded-[11px]'
          } ${active ? 'ring-2 ring-accent' : 'ring-ink/[0.08] hover:ring-ink/[0.2]'} ${
            dimmed ? 'opacity-70 hover:opacity-100 focus-visible:opacity-100' : ''
          }`}
        >
          {cover && (
            <img
              src={cover}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              className="size-full object-cover"
            />
          )}
          {overlay}
        </button>
        {action}
      </div>
      <p
        className={`mt-2 truncate text-[13px] font-medium text-ink-90 ${round ? 'text-center' : ''}`}
      >
        {title}
      </p>
      {subtitle && (
        <p className={`truncate text-[11px] text-ink-40 ${round ? 'text-center' : ''}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function ShelfAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-scheme="dark"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="absolute left-1.5 top-1.5 flex size-6 cursor-pointer items-center justify-center rounded-full bg-black/55 text-ink-90 outline-none transition-colors hover:bg-black/75 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/70"
    >
      {children}
    </button>
  );
}
