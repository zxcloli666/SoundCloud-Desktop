import type {Track} from '../../stores/player';

/* ── Wall item model ─────────────────────────────────────────────
 * One surface, many signals. A tile is a cover; its `kind` only changes
 * subtle treatment (glow temperature, glyph, lyric hook), never which
 * "section" it lives in — there are no sections.
 */
export type TileKind = 'wave' | 'lexical' | 'vibe' | 'lyric';

export interface WallItem {
    track: Track;
    kind: TileKind;
    /** Lyric mode: the matched line, shown as a pull-quote over the cover. */
    matchedLine?: string | null;
    /** Seeded 2×2 anchor tile that breaks the grid rhythm. */
    hero?: boolean;
}

/* ── Genres ──────────────────────────────────────────────────────
 * The ticker is a thin running ribbon, not a hero block. Twelve
 * hand-tuned hues give it rhythm; clicking one seeds a query.
 */
export interface GenreChip {
    key: string;
    label: string;
    color: string;
}

export const GENRES: GenreChip[] = [
    {key: 'lofi', label: 'Lo-fi', color: '#8b9dc3'},
    {key: 'house', label: 'House', color: '#ff7a59'},
    {key: 'phonk', label: 'Phonk', color: '#c026d3'},
    {key: 'ambient', label: 'Ambient', color: '#5eead4'},
    {key: 'rnb', label: 'R&B', color: '#f0abfc'},
    {key: 'trap', label: 'Trap', color: '#fb7185'},
    {key: 'jazz', label: 'Jazz', color: '#fbbf24'},
    {key: 'techno', label: 'Techno', color: '#60a5fa'},
    {key: 'indie', label: 'Indie', color: '#a3e635'},
    {key: 'soul', label: 'Soul', color: '#fca5a5'},
    {key: 'dnb', label: 'DnB', color: '#34d399'},
    {key: 'hyperpop', label: 'Hyperpop', color: '#e879f9'},
];

/** Deterministic, stable HSL hue per genre label — same name → same color. */
export function genreColor(name: string | null | undefined): string {
    const fixed = GENRES.find((g) => g.key === name?.toLowerCase());
    if (fixed) return fixed.color;
    if (!name) return 'var(--color-accent)';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 62%)`;
}

const HOT = [
    'phonk',
    'trap',
    'festival',
    'house',
    'techno',
    'dnb',
    'drum',
    'hardstyle',
    'hyperpop',
    'rave',
    'edm',
    'dubstep',
    'bass',
    'hardcore',
];
const COLD = [
    'ambient',
    'lofi',
    'lo-fi',
    'chill',
    'sad',
    'piano',
    'acoustic',
    'soul',
    'jazz',
    'classical',
    'sleep',
    'study',
    'downtempo',
    'r&b',
    'rnb',
    'slow',
];

/** Vibe energy 0 (calm/cold) .. 1 (hot/fast). Drives orb hue temperature,
 *  drift speed and tile breathing tempo so the room *means* the result. */
export function genreEnergy(name: string | null | undefined): number {
    const n = name?.toLowerCase() ?? '';
    if (HOT.some((h) => n.includes(h))) return 0.85;
    if (COLD.some((c) => n.includes(c))) return 0.2;
    return 0.5;
}

/** Average energy across the dominant genres of a result set. */
export function vibeEnergy(topGenres: string[] | undefined): number {
    if (!topGenres?.length) return 0.5;
    const sum = topGenres.slice(0, 4).reduce((acc, g) => acc + genreEnergy(g), 0);
    return sum / Math.min(topGenres.length, 4);
}

export interface GenreShare {
    genre: string;
    /** Fraction of the genre-tagged tracks this genre accounts for (0..1). */
    share: number;
    color: string;
}

/** The dominant genres of a track set by frequency, each with its share — the
 *  raw material for an aura (top 3) or a full soundprint spectrum (top N). */
export function topGenres(
    tracks: ReadonlyArray<{ genre?: string | null }>,
    n: number,
    fallbackGenre?: string | null,
): GenreShare[] {
    const counts = new Map<string, number>();
    let withGenre = 0;
    for (const tr of tracks) {
        const g = tr.genre?.trim();
        if (!g) continue;
        counts.set(g, (counts.get(g) ?? 0) + 1);
        withGenre++;
    }
    if (counts.size === 0 && fallbackGenre?.trim()) {
        counts.set(fallbackGenre.trim(), 1);
        withGenre = 1;
    }
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([genre, c]) => ({
            genre,
            share: withGenre ? c / withGenre : 0,
            color: genreColor(genre),
        }));
}

const SC_URL = /^https?:\/\/(www\.|m\.|on\.)?soundcloud\.com\/.+/i;

export function isSoundCloudUrl(input: string): boolean {
    return SC_URL.test(input.trim());
}

/** Positional hero stride — used ONLY for the loading skeleton. */
export function isHeroIndex(index: number): boolean {
    return index > 0 && (index + 4) % 9 === 0;
}

/** Cheap stable string hash (FNV-1a) — same string → same number. */
export function hashStr(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/** Hero flag derived from the track's urn, NOT its array position — so a tile
 *  never flips 1×1↔2×2 (and the wall never reflows) when late results re-weave. */
export function isHeroUrn(urn: string): boolean {
    return hashStr(urn) % 9 === 4;
}

/** Position-based hero placement for append-only / fresh lists (landing, vibe,
 *  dive): ~2 heroes per 10 tiles in different rows, so every loaded page is
 *  guaranteed a pair of 2×2 anchors. Stable because those lists only append. */
export function isHeroPos(index: number): boolean {
    const m = index % 10;
    return m === 2 || m === 7;
}

/** Key tiles by stable identity (urn), never array index — a tile that shifts
 *  position re-renders in place instead of remounting (no img re-decode flash). */
export function trackKey(item: WallItem): string {
    return item.track.urn;
}

/* ── Keyframes + wall CSS (injected once, no index.css churn) ─────
 * Everything here is transform/opacity only. Breathing is per-tile CSS
 * with seeded delay/duration (no JS rAF). content-visibility pauses the
 * animation of off-screen tiles for free; [data-hidden] pauses the rest
 * when the tab/window is backgrounded.
 */
export const WALL_KEYFRAMES = `
@keyframes tg-breathe {
  0%, 100% { transform: scale(0.972); opacity: 0.9; }
  50%      { transform: scale(1);     opacity: 1; }
}
@keyframes tg-marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
@keyframes tg-orb-drift {
  0%   { transform: translate3d(0,0,0) scale(1); }
  33%  { transform: translate3d(3%,4%,0) scale(1.08); }
  66%  { transform: translate3d(-3%,2%,0) scale(1.04); }
  100% { transform: translate3d(0,0,0) scale(1); }
}
@keyframes tg-orb-drift-lite {
  0%   { transform: translate3d(0,0,0); }
  33%  { transform: translate3d(3%,4%,0); }
  66%  { transform: translate3d(-3%,2%,0); }
  100% { transform: translate3d(0,0,0); }
}
@keyframes tg-ring-sweep {
  from { stroke-dashoffset: var(--tg-ring-len); }
  to   { stroke-dashoffset: 0; }
}
/* Dim the rest of the wall around whatever the cursor is sampling — only while a
 * tile is actually hovered (:has), so hovering the gaps between tiles dims nothing. */
.tg-wall:has(.tg-tile:hover) .tg-tile:not(:hover) { opacity: 0.55; }
.tg-wall .tg-tile { transition: opacity 600ms cubic-bezier(0.2,0.8,0.2,1); }
.tg-tile:hover { z-index: 5; }
/* Lift layer: hover raises the tile out of the wall (transform/shadow only). */
.tg-lift {
  box-shadow: 0 14px 32px rgba(0,0,0,0.45), inset 0 0 0 0.5px rgba(255,255,255,0.06);
  transition: transform 500ms cubic-bezier(0.2,0.8,0.2,1), box-shadow 500ms cubic-bezier(0.2,0.8,0.2,1);
}
/* Hover keys off the stable grid cell (.tg-tile), NOT the breathing-scaled
 * .tg-lift — otherwise the cursor sitting over a slowly-scaling layer makes the
 * WebView flip :hover on/off ("random card lights up / sticks"). */
.tg-tile:hover .tg-lift {
  transform: translateY(-4px) scale(1.05);
  box-shadow: 0 28px 70px rgba(0,0,0,0.55), inset 0 0 0 0.5px rgba(255,255,255,0.10);
}
/* AI-vibe tiles rest a hair forward ("surfaced by feeling"). */
.tg-vibe .tg-lift { transform: scale(1.02); }
.tg-vibe:hover .tg-lift { transform: translateY(-4px) scale(1.06); }
/* Hovered tile holds its breath mid-rise. */
.tg-tile:hover .tg-breath { animation-play-state: paused !important; }
[data-tg-hidden='1'] .tg-breath,
[data-tg-hidden='1'] .tg-marquee-track,
[data-tg-hidden='1'] .tg-orb { animation-play-state: paused !important; }
@media (prefers-reduced-motion: reduce) {
  .tg-breath, .tg-orb, .tg-marquee-track { animation: none !important; }
  .tg-breath { transform: none !important; opacity: 1 !important; }
}
`;
