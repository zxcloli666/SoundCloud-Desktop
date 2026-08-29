import {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {stopHoverPreview, wirePreviewGuards} from '../../lib/audioPreview';
import {rotateDiscoverRanking} from '../../lib/discover-recommendations';
import {parseCssColor, type Rgb, rgbaCss} from '../../lib/genre-aura';
import type {
    HomeRecommendationFeedback,
    HomeRecommendationInput,
} from '../../lib/home-recommendations';
import {useDiscoverFeed} from '../../lib/hooks';
import {Compass, Shuffle} from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
import {recordClusterFeedback, setUrnCluster} from '../../lib/recsFeedback';
import {useAuthStore} from '../../stores/auth';
import type {Track} from '../../stores/player';
import {useRecommendationTasteStore} from '../../stores/recommendation-taste';
import {useSettingsStore} from '../../stores/settings';
import {
    genreColor,
    genreEnergy,
    isHeroUrn,
    WALL_KEYFRAMES,
    type WallItem,
} from '../search/utils';
import {useTabHidden, Wall} from '../search/Wall';
import {useClusterWave} from '../music/cluster';
import {PrismBand, type PrismSegment} from './PrismBand';

/** A generous-but-bounded mosaic — enough to feel lush, capped so a busy genre
 *  doesn't grow into a wall of dozens of rows inside the Discover page. */
const TRACK_CAP = 24;
/** Tint used only if a genre's colour can't be parsed (never hit for real genres). */
const FALLBACK_RGB: Rgb = [130, 130, 150];
const EMPTY_DISCOVER_CANDIDATES: readonly HomeRecommendationInput[] = [];

function recommendationAttribution(input: HomeRecommendationInput): [string, string] | null {
    if (!('track' in input) || !Array.isArray(input.sources) || input.sources.length === 0) {
        return null;
    }
    const source = [...input.sources].sort(
        (left, right) =>
            left.rank - right.rank ||
            (right.score ?? Number.NEGATIVE_INFINITY) -
                (left.score ?? Number.NEGATIVE_INFINITY),
    )[0];
    return source ? [input.track.urn, source.clusterId] : null;
}

interface DiscoverTasteEpoch {
    candidateSource: readonly HomeRecommendationInput[];
    candidateUpdatedAt: number;
    ownerKey: string;
    languageKey: string;
    hideLiked: boolean;
    hideListened: boolean;
    mode: 'similar' | 'diverse';
    recentTracks: readonly Track[];
    feedback: HomeRecommendationFeedback;
}

/** "Открывай новое" — cluster recommendations first, with a bounded related fallback.
 *  The taste-spectrum selector tunes a hover-samplable cover mosaic, and the panel
 *  re-tints to the genre you're on. */
export const DiscoverPrism = memo(function DiscoverPrism() {
    const {t} = useTranslation();
    const perf = usePerfMode();
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const languages = useSettingsStore((state) => state.soundwaveLanguages);
    const hideLiked = useSettingsStore((state) => state.soundwaveHideLiked);
    const hideListened = useSettingsStore((state) => state.soundwaveHideListened);
    const mode = useSettingsStore((state) => state.soundwaveMode);
    const tasteOwnerUrn = useRecommendationTasteStore((state) => state.ownerUrn);
    const tasteOwnerReady = useRecommendationTasteStore((state) => state.ownerReady);
    const localRecentTracks = useRecommendationTasteStore((state) => state.recentTracks);
    const localTrackTaste = useRecommendationTasteStore((state) => state.tracks);
    const localClusterTaste = useRecommendationTasteStore((state) => state.clusters);
    const stableLanguages = useMemo(() => [...languages].sort(), [languages]);
    const recommendationUrl = useMemo(() => {
        if (!isAuthenticated) return null;
        const query = new URLSearchParams();
        if (stableLanguages.length > 0) query.set('languages', stableLanguages.join(','));
        query.set('hide_listened', hideListened ? '1' : '0');
        return `/recommendations?${query}`;
    }, [hideListened, isAuthenticated, stableLanguages]);
    const recommendationQuery = useClusterWave({
        queryKey: [
            'cluster-wave',
            'editorial-home',
            stableLanguages.join(',') || 'all',
            hideListened,
        ],
        url: recommendationUrl,
        enabled: isAuthenticated,
        staleMs: 5 * 60_000,
        gcMs: 30 * 60_000,
    });
    const candidateSource = recommendationQuery.data?.candidates ?? EMPTY_DISCOVER_CANDIDATES;
    const ownerKey = tasteOwnerReady ? (tasteOwnerUrn ?? 'anonymous') : 'pending';
    const languageKey = stableLanguages.join(',');
    const tasteEpochRef = useRef<DiscoverTasteEpoch | null>(null);
    const previousEpoch = tasteEpochRef.current;
    if (
        !previousEpoch ||
        previousEpoch.candidateSource !== candidateSource ||
        previousEpoch.candidateUpdatedAt !== recommendationQuery.dataUpdatedAt ||
        previousEpoch.ownerKey !== ownerKey ||
        previousEpoch.languageKey !== languageKey ||
        previousEpoch.hideLiked !== hideLiked ||
        previousEpoch.hideListened !== hideListened ||
        previousEpoch.mode !== mode
    ) {
        const canUseLocalTaste = tasteOwnerReady && Boolean(tasteOwnerUrn);
        tasteEpochRef.current = {
            candidateSource,
            candidateUpdatedAt: recommendationQuery.dataUpdatedAt,
            ownerKey,
            languageKey,
            hideLiked,
            hideListened,
            mode,
            recentTracks: canUseLocalTaste ? [...localRecentTracks] : [],
            feedback: canUseLocalTaste
                ? {tracks: localTrackTaste, clusters: localClusterTaste}
                : {},
        };
    }
    const tasteEpoch = tasteEpochRef.current!;
    const {
        likedTracks,
        byGenre: discoverData,
        isLoading,
    } = useDiscoverFeed({
        primaryCandidates: tasteEpoch.candidateSource,
        primaryLoading: recommendationQuery.isLoading,
        recentTracks: tasteEpoch.recentTracks,
        hideLiked: tasteEpoch.hideLiked,
        hideListened: tasteEpoch.hideListened,
        mode: tasteEpoch.mode,
        feedback: tasteEpoch.feedback,
    });

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
        return rotateDiscoverRanking(rawTracks, nonce, TRACK_CAP)
            .filter((tr) => tr?.urn)
            .map((track) => ({track, kind: 'wave' as const, hero: isHeroUrn(track.urn)}));
    }, [rawTracks, nonce]);

    // Stable queue thunk — a fresh array on each re-tint would defeat every tile's memo.
    const itemsRef = useRef(items);
    itemsRef.current = items;
    const getQueue = useCallback(() => itemsRef.current.map((i) => i.track), []);
    const attribution = useMemo(
        () =>
            new Map(
                tasteEpoch.candidateSource
                    .map(recommendationAttribution)
                    .filter((entry): entry is [string, string] => entry !== null),
            ),
        [tasteEpoch.candidateSource],
    );
    const onRecommendationPlay = useCallback(
        (track: Track) => {
            const cluster = attribution.get(track.urn);
            if (!cluster) return;
            setUrnCluster(track.urn, cluster);
            recordClusterFeedback(cluster, 'click');
        },
        [attribution],
    );

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

    if (genres.length === 0 && !isLoading) return null;

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
          <Compass size={15} className="text-white/85"/>
        </span>
                <div className="min-w-0 flex-1">
                    <h2 className="text-[15px] font-bold text-white/95 tracking-tight leading-tight">
                        {t('discover.prismTitle')}
                    </h2>
                    <p className="text-[11px] text-white/35 truncate">{t('discover.prismSubtitle')}</p>
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
                    background: `radial-gradient(120% 100% at 50% 0%, ${tint(0.16)}, ${tint(0.04)} 55%, rgba(255,255,255,0.02))`,
                    border: `0.5px solid ${tint(0.18)}`,
                    boxShadow: `0 24px 60px rgba(0,0,0,0.28), 0 0 60px ${tint(0.1)}, inset 0 1px 0 rgba(255,255,255,0.05)`,
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
                    <Wall
                        items={items}
                        getQueue={getQueue}
                        isLoading={isLoading}
                        onPlay={onRecommendationPlay}
                    />
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
            className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full text-[11px] font-semibold text-white/70 hover:text-white transition-colors duration-300 cursor-pointer shrink-0"
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
