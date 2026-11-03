import {memo, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {parseCssColor, rgbaCss} from '../../lib/genre-aura';
import {usePerfMode} from '../../lib/perf';

export interface PrismSegment {
    /** Lowercased genre key (matches useDiscoverFeed().byGenre output). */
    genre: string;
    /** Fraction of the user's liked tracks this genre accounts for (0..1). */
    share: number;
    /** genreColor(genre) — #hex or hsl(). */
    color: string;
}

interface PrismBandProps {
    segments: PrismSegment[];
    active: string;
    onSelect: (genre: string) => void;
    /** Pre-commit tint: hovering a stripe recolours the panel before you click. */
    onHover: (genre: string | null) => void;
}

/** "Taste Prism" — the listener's taste split into a band of coloured light: one
 *  stripe per genre, its WIDTH ∝ how much of their likes it is, its height + glow
 *  marking the active pick (an equaliser of *you*). Picking a stripe re-tunes the
 *  cover mosaic below; hovering pre-tints the panel. Replaces the old bar tuner.
 *  Width is set once from share (never animated → no reflow); selection/hover are
 *  transform/opacity/box-shadow only. */
export const PrismBand = memo(function PrismBand({
                                                     segments,
                                                     active,
                                                     onSelect,
                                                     onHover,
                                                 }: PrismBandProps) {
    const {t} = useTranslation();
    const perf = usePerfMode();
    const btns = useRef<(HTMLButtonElement | null)[]>([]);

    const onKey = (e: React.KeyboardEvent, i: number) => {
        let ni = i;
        if (e.key === 'ArrowRight') ni = Math.min(i + 1, segments.length - 1);
        else if (e.key === 'ArrowLeft') ni = Math.max(i - 1, 0);
        else if (e.key === 'Home') ni = 0;
        else if (e.key === 'End') ni = segments.length - 1;
        else return;
        e.preventDefault();
        onSelect(segments[ni].genre);
        btns.current[ni]?.focus();
    };

    return (
        <div
            role="radiogroup"
            aria-label={t('discover.prismGenresLabel')}
            className="flex items-end gap-[3px] h-12 sm:h-16 w-full select-none"
            onMouseLeave={() => onHover(null)}
        >
            {segments.map((s, i) => {
                const rgb = parseCssColor(s.color);
                const isActive = s.genre === active;
                const fill = rgb
                    ? `linear-gradient(180deg, ${rgbaCss(rgb, 0.95)}, ${rgbaCss(rgb, 0.32)})`
                    : s.color;
                const pct = Math.round(s.share * 100);
                return (
                    <button
                        key={s.genre}
                        type="button"
                        ref={(el) => {
                            btns.current[i] = el;
                        }}
                        role="radio"
                        aria-checked={isActive}
                        aria-label={s.genre}
                        tabIndex={isActive ? 0 : -1}
                        title={s.genre}
                        onClick={() => onSelect(s.genre)}
                        onMouseEnter={() => onHover(s.genre)}
                        onFocus={() => onHover(s.genre)}
                        onKeyDown={(e) => onKey(e, i)}
                        className="group/seg relative h-full flex flex-col items-center justify-end rounded-lg cursor-pointer"
                        style={{flexGrow: Math.max(s.share, 0.04), flexBasis: 0, minWidth: 44}}
                    >
                        {/* Coloured fill — scaleY from the baseline encodes selection (equaliser). */}
                        <span
                            className="absolute inset-0 rounded-lg transition-[transform,opacity,box-shadow] duration-500 ease-[var(--ease-apple)]"
                            style={{
                                background: fill,
                                transformOrigin: 'bottom',
                                transform: `scaleY(${isActive ? 1 : 0.7})`,
                                opacity: isActive ? 1 : 0.4,
                                boxShadow: isActive
                                    ? `${perf.glow ? `0 0 26px ${rgb ? rgbaCss(rgb, 0.7) : s.color}, ` : ''}inset 0 1.5px 0 rgb(var(--ink) / 0.45)`
                                    : undefined,
                            }}
                        />
                        <span
                            className={`relative z-10 mb-1 px-1 max-w-full truncate capitalize transition-colors duration-300 text-[10px] sm:text-[11px] ${
                                isActive
                                    ? 'font-bold text-ink'
                                    : 'font-medium text-ink-60 group-hover/seg:text-ink-90'
                            }`}
                            style={{textShadow: '0 1px 4px rgba(0,0,0,0.6)'}}
                        >
              {s.genre}
            </span>
                        {isActive && (
                            <span
                                className="relative z-10 mb-1.5 text-[9px] font-bold tabular-nums text-ink-75"
                                style={{textShadow: '0 1px 3px rgba(0,0,0,0.7)'}}
                            >
                {pct}%
              </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
});
