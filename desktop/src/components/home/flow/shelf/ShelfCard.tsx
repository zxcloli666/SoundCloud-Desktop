import type { ReactNode } from 'react';

export const SHELF_CARD_WIDTH = 148;

interface Props {
  scrollKey: string;
  cover: string | null;
  title: string;
  subtitle?: string;
  round?: boolean;
  active?: boolean;
  coverLabel: string;
  onOpen: () => void;
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
  coverLabel,
  onOpen,
  overlay,
  action,
}: Props) {
  return (
    <div
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
          className={`group relative block aspect-square w-full cursor-pointer overflow-hidden bg-ink/[0.06] outline-none ring-1 transition-shadow focus-visible:ring-2 focus-visible:ring-accent/70 ${
            round ? 'rounded-full' : 'rounded-2xl'
          } ${active ? 'ring-2 ring-accent' : 'ring-ink/[0.08] hover:ring-ink/[0.2]'}`}
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
        className={`mt-2.5 truncate text-[13px] font-medium text-ink-90 ${round ? 'text-center' : ''}`}
      >
        {title}
      </p>
      {subtitle && (
        <p className={`truncate text-[11.5px] text-ink-40 ${round ? 'text-center' : ''}`}>
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
      className="absolute right-2 top-2 flex size-7 cursor-pointer items-center justify-center rounded-full bg-black/55 text-ink-90 outline-none transition-colors hover:bg-black/75 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/70"
    >
      {children}
    </button>
  );
}
