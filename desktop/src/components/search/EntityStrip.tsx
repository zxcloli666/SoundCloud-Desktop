import { memo } from 'react';

export interface EntityItem {
  key: string;
  label: string;
  sub?: string;
  image: string | null;
  round: boolean;
  onClick: () => void;
}

interface EntityStripProps {
  items: EntityItem[];
  label?: string;
}

const FADE =
  'linear-gradient(90deg, transparent 0, rgb(var(--ink)) 2%, rgb(var(--ink)) 96%, transparent 100%)';

export const EntityStrip = memo(function EntityStrip({ items, label }: EntityStripProps) {
  if (items.length === 0) return null;
  return (
    <section className="py-2">
      {label && (
        <h2 className="px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-45">
          {label}
        </h2>
      )}
      <div
        className="flex items-center gap-3 overflow-x-auto px-4"
        style={{ scrollbarWidth: 'none', maskImage: FADE, WebkitMaskImage: FADE }}
      >
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            onClick={it.onClick}
            className="group flex shrink-0 cursor-pointer items-center gap-2.5 rounded-full border border-ink/[0.08] py-1 pl-1 pr-3.5 transition-colors hover:bg-ink/[0.06]"
          >
            <span
              className={`relative h-9 w-9 shrink-0 overflow-hidden bg-ink/[0.05] ${it.round ? 'rounded-full' : 'rounded-lg'}`}
            >
              {it.image ? (
                <img
                  src={it.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-ink-40">
                  {it.label.slice(0, 1).toUpperCase()}
                </span>
              )}
            </span>
            <span className="flex min-w-0 flex-col items-start leading-tight">
              <span className="max-w-[140px] truncate text-[12.5px] text-ink-80 transition-colors group-hover:text-ink">
                {it.label}
              </span>
              {it.sub && <span className="text-[10.5px] text-ink-35">{it.sub}</span>}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
});
