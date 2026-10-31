import {memo} from 'react';
import {usePerfMode} from '../../lib/perf';
import {GENRES, type GenreChip} from './utils';

interface GenreTickerProps {
    /** Chips to run — pass the wall's actual popular genres; falls back to GENRES. */
    genres?: GenreChip[];
    onSelect: (genre: string) => void;
}

/* A thin running ribbon of genre chips — whispers "try this" above the wall.
 * Reflects what's actually on the wall (popular genres). The base list is
 * repeated so one copy is wider than the viewport, then doubled for a seamless
 * loop (translateX -50%) — so it fills the full width even on big screens. */
export const GenreTicker = memo(function GenreTicker({genres, onSelect}: GenreTickerProps) {
    const perf = usePerfMode();
    const base = genres && genres.length >= 4 ? genres : GENRES;
    const reps = Math.max(2, Math.ceil(28 / base.length));
    const wide = Array.from({length: reps}, () => base).flat();
    const chips = [...wide, ...wide];

    return (
        <div
            className="group relative h-7 overflow-hidden select-none"
            style={{
                maskImage: 'linear-gradient(90deg, transparent 0, #000 5%, #000 95%, transparent 100%)',
                WebkitMaskImage:
                    'linear-gradient(90deg, transparent 0, #000 5%, #000 95%, transparent 100%)',
            }}
        >
            <div
                className={`tg-marquee-track flex items-center gap-5 whitespace-nowrap group-hover:[animation-play-state:paused]${
                    perf.idleAnim ? ' will-change-transform' : ''
                }`}
                style={
                    perf.idleAnim
                        ? {animation: 'tg-marquee 60s linear infinite', width: 'max-content'}
                        : {width: 'max-content'}
                }
            >
                {chips.map((g, i) => (
                    <button
                        key={`${g.key}-${i}`}
                        type="button"
                        data-ui="chip"
                        onClick={() => onSelect(g.key)}
                        className="group/chip inline-flex items-center gap-1.5 text-[12px] text-ink-45 hover:text-ink-90 transition-colors duration-300 cursor-pointer"
                    >
            <span
                className="w-1.5 h-1.5 rounded-full transition-transform duration-300 group-hover/chip:scale-150"
                style={{background: g.color, boxShadow: `0 0 8px ${g.color}`}}
            />
                        {g.label}
                    </button>
                ))}
            </div>
        </div>
    );
});
