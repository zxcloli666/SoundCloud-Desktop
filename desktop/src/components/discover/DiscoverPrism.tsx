import {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {stopHoverPreview, wirePreviewGuards} from '../../lib/audioPreview';
import {parseCssColor, type Rgb, rgbaCss} from '../../lib/genre-aura';
import {useDiscoverFeed} from '../../lib/hooks';
import {Compass, Shuffle} from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
import type {Track} from '../../stores/player';
import {
    genreColor,
    genreEnergy,
    hashStr,
    isHeroUrn,
    WALL_KEYFRAMES,
    type WallItem,
} from '../search/utils';
import {useTabHidden, Wall} from '../search/Wall';
import {PrismBand, type PrismSegment} from './PrismBand';

/** A generous-but-bounded mosaic — enough to feel lush, capped so a busy genre
 *  doesn't grow into a wall of dozens of rows inside the Discover page. */
const TRACK_CAP = 24;
/** Tint used only if a genre's colour can't be parsed (never hit for real genres). */
const FALLBACK_RGB: Rgb = [130, 130, 150];

/** Deterministic seeded shuffle (LCG-driven Fisher-Yates). Reshuffle re-weaves a
 *  genre's mosaic — and surfaces deeper cuts past the cap — with NO refetch. Seed
 *  0 keeps the backend's relatedness order for the first paint. */
function seededOrder(items: Track[], seed: number): Track[] {
    if (seed === 0) return items;
    const a = items.slice();
    let s = seed >>> 0;
    for (let i = a.length - 1; i > 0; i--) {
        s = (s * 1664525 + 1013904223) >>> 0;
        const j = s % (i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** "Открывай новое" — your taste as a prism. The data is unchanged (related tracks
 *  to your likes, grouped by your top genres); the surface is the Search aesthetic
 *  aimed back at you: a taste-spectrum selector tunes a breathing, hover-samplable
 *  cover mosaic, and the whole panel re-tints to the genre you're on. */
export const DiscoverPrism = memo(function DiscoverPrism() {
    const {t} = useTranslation();
    const perf = usePerfMode();
    const {likedTracks, byGenre: discoverData} = useDiscoverFeed();

    const [activeGenre, setActiveGenre] = useState<string | null>(null);
    const [hoveredGenre, setHoveredGenre] = useState<string | null>(null);
    const [nonce, setNonce] = useState(0);

    const genres = useMemo(() => discoverData.map((d) => d.genre), [discoverData]);
    const selectedGenre =
        activeGenre && genres.includes(activeGenre) ? activeGenre : (genres[0] ?? null);

    // Taste composition: count liked tracks per shown genre, normalised over only the
    // genres on the band so the widths sum to 1 and read as "% of you".
    const segments = useMemo<PrismSegment[]>(() => {
        const counts = new Map<string, number>();
        for (const tr of likedTracks) {
            const g = tr.genre?.trim().toLowerCase();
            if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
        }
        const raw = genres.map((g) => ({genre: g, count: Math.max(counts.get(g) ?? 1, 1)}));
        const total = raw.reduce((sum, r) => sum + r.count, 0) || 1;
        return raw.map((r) => ({genre: r.genre, share: r.count / total, color: genreColor(r.genre)}));
    }, [genres, likedTracks]);

    const rawTracks = useMemo(
        () => discoverData.find((d) => d.genre === selectedGenre)?.tracks ?? [],
        [discoverData, selectedGenre],
    );
    const items = useMemo<WallItem[]>(() => {
        const seed = nonce === 0 ? 0 : hashStr(`${selectedGenre}:${nonce}`);
        return seededOrder(rawTracks, seed)
            .filter((tr) => tr?.urn)
            .slice(0, TRACK_CAP)
            .map((track) => ({track, kind: 'wave' as const, hero: isHeroUrn(track.urn)}));
    }, [rawTracks, selectedGenre, nonce]);

    // Stable queue thunk — a fresh array on each re-tint would defeat every tile's memo.
    const itemsRef = useRef(items);
    itemsRef.current = items;
    const getQueue = useCallback(() => itemsRef.current.map((i) => i.track), []);

    const hidden = useTabHidden();

    // Hover-preview is a single global channel: wire the guard once, and never let a
    // sample bleed across navigation (mouse-leave doesn't fire on a route change).
    useEffect(() => {
        wirePreviewGuards();
        return () => stopHoverPreview();
    }, []);
    // Switching stations cuts any sample in flight and re-opens the genre in its
    // relatedness order (a stale reshuffle nonce must not bleed across genres).
    // biome-ignore lint/correctness/useExhaustiveDependencies: react only to genre changes
    useEffect(() => {
        stopHoverPreview();
        setNonce(0);
    }, [selectedGenre]);

    // Panel tint follows the hovered stripe (pre-commit) else the active one.
    const tintGenre = hoveredGenre ?? selectedGenre;
    const tintRgb = useMemo<Rgb>(
        () => parseCssColor(genreColor(tintGenre)) ?? FALLBACK_RGB,
        [tintGenre],
    );
    const tint = useCallback((alpha: number) => rgbaCss(tintRgb, alpha), [tintRgb]);
    const driftDur = `${(24 * (1.6 - genreEnergy(tintGenre))).toFixed(1)}s`;

    if (genres.length === 0) return null;

    return (
        <section className="relative" data-tg-hidden={hidden ? '1' : '0'}>
            <style>{WALL_KEYFRAMES}</style>

            <div className="flex items-center gap-3 px-1 mb-4">
        <span
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{
                background: `linear-gradient(135deg, ${tint(0.3)}, ${tint(0.04)})`,
                boxShadow: `inset 0 0 0 1px ${tint(0.4)}`,
                transition: 'background 700ms ease',
            }}
        >
          <Compass size={15} className="text-ink-85"/>
        </span>
                <div className="min-w-0 flex-1">
                    <h2 className="text-[15px] font-bold text-ink-95 tracking-tight leading-tight">
                        {t('discover.prismTitle')}
                    </h2>
                    <p className="text-[11px] text-ink-35 truncate">{t('discover.prismSubtitle')}</p>
                </div>
                <ReshuffleButton
                    onClick={() => setNonce((n) => n + 1)}
                    tint={tint}
                    label={t('discover.prismShuffle')}
                />
            </div>

            <div className="px-1 mb-4">
                <PrismBand
                    segments={segments}
                    active={selectedGenre ?? ''}
                    onSelect={setActiveGenre}
                    onHover={setHoveredGenre}
                />
            </div>

            <div
                className="relative rounded-[2rem] overflow-hidden p-2 md:p-4"
                style={{
                    background: `radial-gradient(120% 100% at 50% 0%, ${tint(0.16)}, ${tint(0.04)} 55%, rgb(var(--ink) / 0.02))`,
                    border: `0.5px solid ${tint(0.18)}`,
                    boxShadow: `0 24px 60px rgb(var(--shade) / calc(0.28 * var(--shade-alpha))), 0 0 60px ${tint(0.1)}, inset 0 1px 0 rgba(255,255,255,0.05)`,
                    transition: 'background 700ms ease, border-color 700ms ease, box-shadow 700ms ease',
                    isolation: 'isolate',
                }}
            >
                {perf.bloom && (
                    <div
                        className="absolute inset-0 pointer-events-none overflow-hidden"
                        style={{contain: 'strict', transform: 'translateZ(0)'}}
                    >
                        <div
                            className="tg-orb absolute -top-1/4 left-1/4 w-[60%] aspect-square rounded-full mix-blend-screen"
                            style={{
                                background: `radial-gradient(circle, ${tint(0.5)} 0%, transparent 65%)`,
                                filter: `blur(${perf.blur(90)}px)`,
                                opacity: 0.28,
                                animation: perf.idleAnim
                                    ? `tg-orb-drift-lite ${driftDur} ease-in-out infinite`
                                    : undefined,
                                transition: 'background 700ms ease',
                            }}
                        />
                    </div>
                )}
                <div className="relative" style={{isolation: 'isolate'}}>
                    <Wall items={items} getQueue={getQueue} isLoading={false}/>
                </div>
            </div>
        </section>
    );
});

const ReshuffleButton = memo(function ReshuffleButton({
                                                          onClick,
                                                          tint,
                                                          label,
                                                      }: {
    onClick: () => void;
    tint: (alpha: number) => string;
    label: string;
}) {
    const [turns, setTurns] = useState(0);
    return (
        <button
            type="button"
            onClick={() => {
                setTurns((x) => x + 1);
                onClick();
            }}
            aria-label={label}
            title={label}
            className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full text-[11px] font-semibold text-ink-70 hover:text-ink transition-colors duration-300 cursor-pointer shrink-0"
            style={{background: tint(0.1), border: `0.5px solid ${tint(0.22)}`}}
        >
            <Shuffle
                size={13}
                className="transition-transform duration-500 ease-[var(--ease-apple)]"
                style={{transform: `rotate(${turns * 180}deg)`}}
            />
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
});
