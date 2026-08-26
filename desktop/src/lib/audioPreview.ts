import {useSyncExternalStore} from 'react';
import {usePlayerStore} from '../stores/player';
import {getCacheInfo} from './cache';
import {trackedInvoke as invoke} from './diagnostics';

/* ── Hover-preview controller ─────────────────────────────────────
 * A single-track sampling channel that rides the Rust preview player
 * (audio_preview_play / audio_preview_stop). One preview at a time,
 * debounced on hover, starting at target volume and fading out on leave,
 * sourced from the existing track cache. It never touches the main player
 * or writes plays history.
 *
 * Deliberate gate: we never sample over an actively-playing main player
 * (that's cacophony) and never preview the track that's already loaded.
 * On the landing wall nothing is playing, so the whole wall is sample-
 * on-hover; while music plays, hover is visual-only.
 */

const HOVER_DEBOUNCE_MS = 400;
const FADE_OUT_MS = 500;
export const PREVIEW_WINDOW_MS = 15_000;
const PREVIEW_VOLUME_FACTOR = 0.85;

let hoverTimer: ReturnType<typeof setTimeout> | null = null;
let windowTimer: ReturnType<typeof setTimeout> | null = null;
let activeUrn: string | null = null;
let pendingUrn: string | null = null;
let startGen = 0;

const listeners = new Set<() => void>();

function notify() {
    for (const l of listeners) l();
}

function canPreview(urn: string): boolean {
    const s = usePlayerStore.getState();
    if (s.isPlaying) return false;
    if (s.currentTrack?.urn === urn) return false;
    return true;
}

/** Hover a tile: after a debounce, preview only an already-cached track.
 *
 * A hover must never start a full background download: moving across the search
 * wall could otherwise fill every network/cache slot and make the track the user
 * actually clicked wait behind speculative work. Lightweight stream resolution
 * is handled separately by `preloadTrack`.
 */
export function startHoverPreview(urn: string): void {
    if (activeUrn === urn || pendingUrn === urn) return;
    if (hoverTimer) clearTimeout(hoverTimer);
    pendingUrn = urn;
    hoverTimer = setTimeout(async () => {
        hoverTimer = null;
        if (pendingUrn !== urn) return;
        if (document.visibilityState === 'hidden' || !canPreview(urn)) {
            pendingUrn = null;
            return;
        }
        const gen = ++startGen;
        try {
            const info = await getCacheInfo(urn);
            // Superseded by a newer hover, or no longer allowed.
            if (gen !== startGen || pendingUrn !== urn || !info?.path || !canPreview(urn)) return;
            const volume = (usePlayerStore.getState().volume / 100) * PREVIEW_VOLUME_FACTOR;
            await invoke('audio_preview_play', {path: info.path, volume, gen});
            if (gen !== startGen) {
                invoke('audio_preview_stop', {fadeMs: 0, gen}).catch(() => {
                });
                return;
            }
            activeUrn = urn;
            pendingUrn = null;
            notify();
            if (windowTimer) clearTimeout(windowTimer);
            windowTimer = setTimeout(() => stopHoverPreview(), PREVIEW_WINDOW_MS);
        } catch {
            // Silent fail — a preview that can't load just never lights.
            if (pendingUrn === urn) pendingUrn = null;
        }
    }, HOVER_DEBOUNCE_MS);
}

function endPreview(fadeMs: number): void {
    if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
    }
    if (windowTimer) {
        clearTimeout(windowTimer);
        windowTimer = null;
    }
    startGen++; // cancel any in-flight start
    pendingUrn = null;
    if (activeUrn != null) {
        activeUrn = null;
        invoke('audio_preview_stop', {fadeMs, gen: 0}).catch(() => {
        });
        notify();
    }
}

/** Unhover / fast-scroll / leave / route-away: gracefully fade the preview out. */
export function stopHoverPreview(): void {
    endPreview(FADE_OUT_MS);
}

/** User committed to a real play (click / dive): cut the sample instantly so it
 *  never overlaps the main player about to start on the shared mixer. */
export function hardStopHoverPreview(): void {
    endPreview(0);
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Reactive per-tile: is THIS urn the one being previewed? Snapshot is a boolean,
 *  so only the tiles whose state actually flips re-render (not the whole wall). */
export function useIsPreviewActive(urn: string): boolean {
    return useSyncExternalStore(subscribe, () => activeUrn === urn);
}

/* Kill any preview the moment the main player starts or changes track, and
 * when the tab is hidden — so a sample never bleeds into real playback. */
let wired = false;

export function wirePreviewGuards(): void {
    if (wired) return;
    wired = true;
    usePlayerStore.subscribe((state, prev) => {
        if (
            (state.isPlaying && !prev.isPlaying) ||
            state.currentTrack?.urn !== prev.currentTrack?.urn
        ) {
            stopHoverPreview();
        }
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') stopHoverPreview();
    });
}
