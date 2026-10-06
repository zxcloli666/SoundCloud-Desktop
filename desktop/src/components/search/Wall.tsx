import {memo, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {Track} from '../../stores/player';
import {InfiniteSentinel} from '../discover/InfiniteSentinel';
import {CoverTile} from './CoverTile';
import {isHeroIndex, trackKey, type WallItem} from './utils';

interface WallProps {
    items: WallItem[];
    /** Stable thunk → live play queue (see CoverTile); a fresh array prop would
     *  defeat every tile's memo on each page append. */
    getQueue: () => Track[];
    isLoading: boolean;
    hasMore?: boolean;
    isFetchingMore?: boolean;
    onLoadMore?: () => void;
    onDive?: (track: Track) => void;
}

const GAP = 12;
const MIN_COLS = 2;
const MAX_COLS = 10;
/** Retained-tile cap: infinite scroll appends without bound, so window the DOM to
 *  the most recent tiles, capping DOM nodes / decoded images / memory. A leading
 *  spacer holds the grid rows the dropped tiles occupied so the visible layout and
 *  scroll position don't shift. */
const RETAIN_CAP = 150;

/** Target tile edge scales with the viewport — bigger tiles on big screens. */
function targetFor(width: number): number {
    if (width >= 2200) return 252;
    if (width >= 1600) return 224;
    if (width >= 1100) return 198;
    return 172;
}

function computeGrid(width: number): { columns: number; cellPx: number } {
    if (width <= 0) return {columns: 4, cellPx: 198};
    const target = targetFor(width);
    const columns = Math.max(
        MIN_COLS,
        Math.min(MAX_COLS, Math.floor((width + GAP) / (target + GAP))),
    );
    const cellPx = (width - GAP * (columns - 1)) / columns;
    return {columns, cellPx};
}

/* The wall: one deterministic packed mosaic of square tiles. Columns + cell size
 * come from a ResizeObserver; grid-auto-rows is a fixed px height so a tile can
 * never collapse (even mid-image-load), and grid-auto-flow:dense slots the seeded
 * 2×2 heroes into the rhythm. The DOM is bounded by RETAIN_CAP, so every retained
 * tile renders. */
export const Wall = memo(function Wall({
                                           items,
                                           getQueue,
                                           isLoading,
                                           hasMore,
                                           isFetchingMore,
                                           onLoadMore,
                                           onDive,
                                       }: WallProps) {
    const ref = useRef<HTMLDivElement | null>(null);
    const fillAtRef = useRef(-1);
    const [{columns, cellPx}, setGrid] = useState(() => computeGrid(0));

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const measure = () => {
            const next = computeGrid(el.clientWidth);
            setGrid((prev) =>
                prev.columns === next.columns && Math.abs(prev.cellPx - next.cellPx) < 0.5 ? prev : next,
            );
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const showSkeleton = isLoading && items.length === 0;

    // Window to the most recent RETAIN_CAP tiles; estimate the grid rows the dropped
    // leading tiles consumed (heroes = 4 cells, others = 1) and reserve them with a
    // full-width spacer so packed tiles below keep their position. Off by a hero or
    // two vs. dense-flow exact packing, but it pins scroll and bounds the DOM.
    const {visible, spacerRows} = useMemo(() => {
        if (items.length <= RETAIN_CAP) return {visible: items, spacerRows: 0};
        const start = items.length - RETAIN_CAP;
        let cells = 0;
        for (let i = 0; i < start; i++) cells += items[i].hero ? 4 : 1;
        return {visible: items.slice(start), spacerRows: Math.ceil(cells / columns)};
    }, [items, columns]);

    // A grid change (resize → more/taller cells) can re-open empty space below the
    // last page. Clear the "grew nothing" latch so auto-fill re-evaluates instead
    // of staying short until the item count happens to change.
    // biome-ignore lint/correctness/useExhaustiveDependencies: reset only on grid change
    useEffect(() => {
        fillAtRef.current = -1;
    }, [columns, cellPx]);

    // Auto-fill: a single wave page can leave a big screen under-filled, so the
    // sentinel never has to scroll into view. Keep loading until the content
    // overflows the scroll viewport — but only while the wall is still GROWING.
    // If the previous fetch added nothing (exhausted / stuck cursor / all dupes),
    // stop, or we'd hammer the backend with identical requests. columns/cellPx are
    // deliberate deps: a resize re-runs this so a newly-opened gap auto-fills.
    // biome-ignore lint/correctness/useExhaustiveDependencies: columns/cellPx re-trigger on resize
    useEffect(() => {
        if (showSkeleton || !hasMore || isFetchingMore || !onLoadMore) return;
        if (items.length === fillAtRef.current) return; // last fetch grew nothing → give up
        const scroller = ref.current?.closest('main');
        if (scroller && scroller.scrollHeight <= scroller.clientHeight + 240) {
            fillAtRef.current = items.length;
            onLoadMore();
        }
    }, [items.length, hasMore, isFetchingMore, onLoadMore, showSkeleton, columns, cellPx]);

    return (
        <>
            <div
                ref={ref}
                className="tg-wall grid px-4"
                style={{
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                    gridAutoRows: `${cellPx}px`,
                    gap: GAP,
                    gridAutoFlow: 'dense',
                }}
            >
                {showSkeleton ? (
                    Array.from({length: Math.max(columns * 5, 18)}, (_, i) => (
                        <div
                            key={`sk-${i}`}
                            className="rounded-2xl skeleton-shimmer"
                            style={{
                                gridColumn: isHeroIndex(i) ? 'span 2' : 'span 1',
                                gridRow: isHeroIndex(i) ? 'span 2' : 'span 1',
                                background: 'rgba(255,255,255,0.04)',
                            }}
                        />
                    ))
                ) : (
                    <>
                        {spacerRows > 0 && (
                            <div aria-hidden style={{gridColumn: '1 / -1', gridRow: `span ${spacerRows}`}}/>
                        )}
                        {visible.map((item) => (
                            <CoverTile key={trackKey(item)} item={item} getQueue={getQueue} onDive={onDive}/>
                        ))}
                    </>
                )}
            </div>

            {!showSkeleton && hasMore && onLoadMore && (
                <InfiniteSentinel hasMore={hasMore} isFetching={!!isFetchingMore} onLoadMore={onLoadMore}/>
            )}
        </>
    );
});

/* Re-export so the page can mark the wall hidden when the tab is backgrounded
 * (pauses breathing/orb animation via the [data-tg-hidden] CSS gate). */
export function useTabHidden(): boolean {
    const [hidden, setHidden] = useState(
        typeof document !== 'undefined' && document.visibilityState === 'hidden',
    );
    useEffect(() => {
        const on = () => setHidden(document.visibilityState === 'hidden');
        document.addEventListener('visibilitychange', on);
        return () => document.removeEventListener('visibilitychange', on);
    }, []);
    return hidden;
}
