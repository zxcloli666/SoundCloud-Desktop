import {memo} from 'react';

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
}

/* A compact, horizontally-scrolling strip of artists / playlists / users that
 * lives above the wall — never a stacked "section". Renders nothing when empty. */
export const EntityStrip = memo(function EntityStrip({items}: EntityStripProps) {
    if (items.length === 0) return null;
    return (
        <div
            className="flex items-center gap-3 px-4 py-2 overflow-x-auto"
            style={{
                scrollbarWidth: 'none',
                maskImage: 'linear-gradient(90deg, transparent 0, #000 2%, #000 96%, transparent 100%)',
                WebkitMaskImage:
                    'linear-gradient(90deg, transparent 0, #000 2%, #000 96%, transparent 100%)',
            }}
        >
            {items.map((it) => (
                <button
                    key={it.key}
                    type="button"
                    onClick={it.onClick}
                    className="group shrink-0 flex items-center gap-2.5 pl-1 pr-3.5 py-1 rounded-full transition-colors duration-300 cursor-pointer hover:bg-ink/[0.06]"
                    style={{border: '0.5px solid rgb(var(--ink) / 0.08)'}}
                >
          <span
              className={`relative w-9 h-9 shrink-0 overflow-hidden ${it.round ? 'rounded-full' : 'rounded-lg'}`}
              style={{background: 'rgb(var(--ink) / 0.05)'}}
          >
            {it.image ? (
                <img
                    src={it.image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="absolute inset-0 w-full h-full object-cover"
                />
            ) : (
                <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-ink-40">
                {it.label.slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>
                    <span className="flex flex-col items-start leading-tight min-w-0">
            <span
                className="max-w-[140px] truncate text-[12.5px] text-ink-80 group-hover:text-ink transition-colors">
              {it.label}
            </span>
                        {it.sub && <span className="text-[10.5px] text-ink-35">{it.sub}</span>}
          </span>
                </button>
            ))}
        </div>
    );
});
