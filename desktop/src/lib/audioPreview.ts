import { listen } from '@tauri-apps/api/event';
import { useSyncExternalStore } from 'react';
import { type Track, usePlayerStore } from '../stores/player';
import { useSettingsStore } from '../stores/settings';
import {
  ensureTrackCached,
  expectedDurationMs,
  getCacheInfo,
  isHoverPreloadEnabled,
} from './cache';
import { trackedInvoke as invoke } from './diagnostics';
import { previewStartMs } from './moment';
import { volumeGain } from './volume';

/* ── Hover-preview controller ─────────────────────────────────────
 * A single-track sampling channel that rides the Rust preview player
 * (audio_preview_play / audio_preview_stop). One preview at a time,
 * debounced on hover, starting at target volume and fading out on leave,
 * sourced from the existing track cache. It never touches the main player
 * or writes plays history.
 */

const HOVER_DEBOUNCE_MS = 1_000;
const ACK_TIMEOUT_MS = 1_200;
const FADE_OUT_MS = 500;
export const PREVIEW_WINDOW_MS = 15_000;
const PREVIEW_VOLUME_FACTOR = 0.85;
const FADE_IN_MS = 200;
const RESUME_SETTLE_MS = 400;

let hoverTimer: ReturnType<typeof setTimeout> | null = null;
let windowTimer: ReturnType<typeof setTimeout> | null = null;
let activeUrn: string | null = null;
let pendingUrn: string | null = null;
let startGen = 0;
let wireGen = 0;
let claimed = false;
let awaitingWire: number | null = null;
let awaitingUrn: string | null = null;
let ackTimer: ReturnType<typeof setTimeout> | null = null;
let resumeTimer: ReturnType<typeof setTimeout> | null = null;
let pausedMainUrn: string | null = null;

const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function nextPreviewGen(): number {
  wireGen += 1;
  return wireGen;
}

export function claimPreviewChannel(on: boolean): void {
  claimed = on;
  if (on) hardStopHoverPreview();
}

function canPreview(urn: string): boolean {
  if (claimed) return false;
  const s = usePlayerStore.getState();
  if (s.isPlaying && !useSettingsStore.getState().hoverPreviewDuringPlayback) return false;
  if (s.currentTrack?.urn === urn) return false;
  return true;
}

function clearResume(): void {
  if (!resumeTimer) return;
  clearTimeout(resumeTimer);
  resumeTimer = null;
}

function scheduleResume(): void {
  if (!pausedMainUrn) return;
  clearResume();
  resumeTimer = setTimeout(() => {
    resumeTimer = null;
    if (hoverTimer || pendingUrn || activeUrn || awaitingWire !== null) return;
    const player = usePlayerStore.getState();
    const urn = pausedMainUrn;
    pausedMainUrn = null;
    if (urn && !player.isPlaying && player.currentTrack?.urn === urn) player.resume();
  }, RESUME_SETTLE_MS);
}

/** Hover a tile: after a debounce, ensure it's cached and start a preview. */
export function startHoverPreview(track: Track, windowMs = PREVIEW_WINDOW_MS): void {
  const urn = track.urn;
  if (activeUrn === urn || pendingUrn === urn) return;
  if (hoverTimer) clearTimeout(hoverTimer);
  clearResume();
  pendingUrn = urn;
  hoverTimer = setTimeout(async () => {
    hoverTimer = null;
    if (pendingUrn !== urn) return;
    if (document.visibilityState === 'hidden' || !canPreview(urn)) {
      pendingUrn = null;
      return;
    }
    const player = usePlayerStore.getState();
    if (player.isPlaying) {
      player.pause();
      pausedMainUrn = player.currentTrack?.urn ?? null;
    }
    const gen = ++startGen;
    try {
      // Reuse the cache at the user's normal quality — never force a low-quality
      // download that could become the canonical cached copy (coalesces with the
      // hq preloadTrack fired on the same hover).
      const [info, startMs] = await Promise.all([
        isHoverPreloadEnabled()
          ? ensureTrackCached(
              urn,
              undefined,
              expectedDurationMs(track),
              track._scd_meta?.storage_quality,
              true,
            )
          : getCacheInfo(urn),
        previewStartMs(track, windowMs),
      ]);
      // Superseded by a newer hover, or no longer allowed.
      if (gen !== startGen) return;
      if (pendingUrn !== urn || !info?.path || !canPreview(urn)) {
        if (pendingUrn === urn) pendingUrn = null;
        scheduleResume();
        return;
      }
      const volume = volumeGain(usePlayerStore.getState().volume) * PREVIEW_VOLUME_FACTOR;
      const wire = nextPreviewGen();
      awaitingWire = wire;
      awaitingUrn = urn;
      await invoke('audio_preview_play', {
        request: {
          path: info.path,
          volume,
          gen: wire,
          startMs,
          fadeInMs: FADE_IN_MS,
          report: true,
        },
      });
      if (gen !== startGen) {
        invoke('audio_preview_stop', { fadeMs: 0, gen: wire }).catch(() => {});
        return;
      }
      if (ackTimer) clearTimeout(ackTimer);
      ackTimer = setTimeout(() => {
        if (awaitingWire !== wire) return;
        awaitingWire = null;
        awaitingUrn = null;
        if (pendingUrn === urn) pendingUrn = null;
        invoke('audio_preview_stop', { fadeMs: 0, gen: wire }).catch(() => {});
      }, ACK_TIMEOUT_MS);
      if (windowTimer) clearTimeout(windowTimer);
      windowTimer = setTimeout(() => stopHoverPreview(), windowMs + ACK_TIMEOUT_MS);
    } catch {
      // Silent fail — a preview that can't load just never lights.
      if (pendingUrn === urn) pendingUrn = null;
      scheduleResume();
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
  if (ackTimer) {
    clearTimeout(ackTimer);
    ackTimer = null;
  }
  startGen++; // cancel any in-flight start
  pendingUrn = null;
  awaitingWire = null;
  awaitingUrn = null;
  if (activeUrn != null) {
    activeUrn = null;
    invoke('audio_preview_stop', { fadeMs, gen: 0 }).catch(() => {});
    notify();
  }
  scheduleResume();
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
  void listen<{ gen: number; ms: number }>('audio:preview-tick', ({ payload }) => {
    if (payload.gen !== awaitingWire || !awaitingUrn) return;
    if (ackTimer) clearTimeout(ackTimer);
    ackTimer = null;
    activeUrn = awaitingUrn;
    pendingUrn = null;
    awaitingWire = null;
    awaitingUrn = null;
    notify();
  });
  usePlayerStore.subscribe((state, prev) => {
    if (
      (state.isPlaying && !prev.isPlaying) ||
      state.currentTrack?.urn !== prev.currentTrack?.urn
    ) {
      pausedMainUrn = null;
      stopHoverPreview();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') stopHoverPreview();
  });
}
