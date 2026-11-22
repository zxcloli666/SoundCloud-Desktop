import { listen } from '@tauri-apps/api/event';
import { useSyncExternalStore } from 'react';
import { type Track, usePlayerStore } from '../../stores/player';
import { claimPreviewChannel, nextPreviewGen } from '../audioPreview';
import { ensureTrackCached, expectedDurationMs } from '../cache';
import { trackedInvoke as invoke } from '../diagnostics';
import { recordSeek } from '../events';
import { type MomentWindow, momentWindow, trackMoment } from '../moment';
import type { PlaybackClock } from '../video-sync';

export type MomentPhase = 'idle' | 'loading' | 'playing' | 'paused' | 'handed' | 'failed';

export const AUTO_CROSSFADE_MS = 1400;
export const SWIPE_CROSSFADE_MS = 450;
const FADE_IN_MS = 300;
const STOP_FADE_MS = 400;
const SEEK_FADE_MS = 60;

interface Live {
  urn: string;
  path: string;
  window: MomentWindow;
  gen: number;
  endFired: boolean;
}

let live: Live | null = null;
let positionMs = 0;
let positionAt = 0;
let phase: MomentPhase = 'idle';
let phaseUrn: string | null = null;
let token = 0;
let onWindowEnd: ((urn: string) => void) | null = null;
let endTimer: ReturnType<typeof setTimeout> | null = null;
let pausedMainForMoment = false;

const progressListeners = new Set<() => void>();
const phaseListeners = new Set<() => void>();

export function openMoments(onEnd: (urn: string) => void): () => void {
  onWindowEnd = onEnd;
  claimPreviewChannel(true);
  const unlisten = [
    listen<{ gen: number; ms: number }>('audio:preview-tick', (event) =>
      onTick(event.payload.gen, event.payload.ms),
    ),
    listen<number>('audio:preview-ended', (event) => onEnded(event.payload)),
  ];
  const unsubscribe = usePlayerStore.subscribe((state, prev) => {
    if (state.isPlaying && !prev.isPlaying && phase === 'playing' && !pausedMainForMoment) {
      pauseMoment();
    }
    if (state.volume !== prev.volume && live) {
      invoke('audio_preview_volume', { volume: previewVolume() }).catch(() => {});
    }
  });
  return () => {
    onWindowEnd = null;
    unsubscribe();
    for (const off of unlisten) void off.then((fn) => fn());
    stopMoments(STOP_FADE_MS);
    claimPreviewChannel(false);
  };
}

export async function playMoment(track: Track, crossfadeMs: number): Promise<boolean> {
  const mine = ++token;
  disarmActiveWindow();
  setPhase('loading', track.urn);
  let pausedForThisMoment = false;
  try {
    const [info, moment] = await Promise.all([
      ensureTrackCached(
        track.urn,
        undefined,
        expectedDurationMs(track),
        track._scd_meta?.storage_quality,
      ),
      momentWindow(track),
    ]);
    if (mine !== token) return false;
    const player = usePlayerStore.getState();
    if (player.isPlaying) {
      player.pause();
      pausedMainForMoment = true;
      pausedForThisMoment = true;
    }
    const gen = nextPreviewGen();
    const startedMs = await invoke<number>('audio_preview_play', {
      request: {
        path: info.path,
        volume: previewVolume(),
        gen,
        startMs: moment.startMs,
        endMs: moment.startMs + moment.lengthMs,
        fadeInMs: FADE_IN_MS,
        crossfadeMs: live ? crossfadeMs : 0,
        report: true,
      },
    });
    if (mine !== token) {
      invoke('audio_preview_stop', { fadeMs: 0, gen }).catch(() => {});
      return false;
    }
    const startMs = startedMs > 0 ? startedMs : 0;
    const next: Live = {
      urn: track.urn,
      path: info.path,
      window: { ...moment, startMs },
      gen,
      endFired: false,
    };
    live = next;
    scheduleWindowEnd(next, startMs);
    setPosition(startMs);
    notifyProgress();
    setPhase('playing', track.urn);
    return true;
  } catch (e) {
    console.debug('[moments] play failed', e);
    if (pausedForThisMoment && mine === token) {
      pausedMainForMoment = false;
      usePlayerStore.getState().resume();
    }
    if (mine === token) setPhase('failed', track.urn);
    return false;
  }
}

export function pauseMoment(): void {
  if (!live || phase !== 'playing') return;
  clearWindowEnd();
  invoke('audio_preview_pause', { paused: true, gen: live.gen }).catch(() => {});
  setPhase('paused', live.urn);
}

export function resumeMoment(): boolean {
  if (!live || phase !== 'paused' || live.endFired) return false;
  invoke('audio_preview_pause', { paused: false, gen: live.gen }).catch(() => {});
  scheduleWindowEnd(live, positionMs || live.window.startMs);
  setPhase('playing', live.urn);
  return true;
}

export async function seekMoment(urn: string, share: number): Promise<void> {
  const current = live;
  if (!current || current.urn !== urn) return;
  const { startMs, lengthMs } = current.window;
  const targetMs = Math.round(startMs + Math.min(0.98, Math.max(0, share)) * lengthMs);
  const mine = ++token;
  disarmActiveWindow();
  const gen = nextPreviewGen();
  try {
    await invoke<number>('audio_preview_play', {
      request: {
        path: current.path,
        volume: previewVolume(),
        gen,
        startMs: targetMs,
        endMs: startMs + lengthMs,
        fadeInMs: SEEK_FADE_MS,
        crossfadeMs: SEEK_FADE_MS,
        report: true,
      },
    });
  } catch (e) {
    console.debug('[moments] seek failed', e);
    if (live === current) {
      current.endFired = false;
      scheduleWindowEnd(current, positionMs || current.window.startMs);
    }
    return;
  }
  if (mine !== token || live !== current) {
    invoke('audio_preview_stop', { fadeMs: 0, gen }).catch(() => {});
    return;
  }
  live = { ...current, gen, endFired: false };
  scheduleWindowEnd(live, targetMs);
  recordSeek(urn, targetMs, positionMs, 'moment');
  setPosition(targetMs);
  notifyProgress();
  setPhase('playing', urn);
}

export function toggleMoment(track: Track): void {
  if (phaseUrn === track.urn && phase === 'playing') {
    pauseMoment();
    return;
  }
  if (phaseUrn === track.urn && resumeMoment()) return;
  void playMoment(track, 0);
}

export function handOffMoment(urn: string): void {
  token += 1;
  clearWindowEnd();
  live = null;
  pausedMainForMoment = false;
  invoke('audio_preview_stop', { fadeMs: STOP_FADE_MS, gen: 0 }).catch(() => {});
  setPhase('handed', urn);
}

export function stopMoments(fadeMs: number): void {
  token += 1;
  clearWindowEnd();
  const wasLive = live !== null;
  live = null;
  positionMs = 0;
  if (wasLive) invoke('audio_preview_stop', { fadeMs, gen: 0 }).catch(() => {});
  setPhase('idle', null);
  if (pausedMainForMoment) {
    pausedMainForMoment = false;
    usePlayerStore.getState().resume();
  }
}

export function prefetchMoment(track: Track): void {
  ensureTrackCached(
    track.urn,
    undefined,
    expectedDurationMs(track),
    track._scd_meta?.storage_quality,
    true,
  ).catch(() => {});
}

export function momentStartMs(track: Track): number {
  const moment = trackMoment(track);
  if (moment) return moment.startMs;
  return live?.urn === track.urn ? live.window.startMs : 0;
}

export function momentShare(urn: string): number {
  if (!live || live.urn !== urn) return 0;
  const { startMs, lengthMs } = live.window;
  if (lengthMs <= 0) return 0;
  return Math.min(1, Math.max(0, (positionMs - startMs) / lengthMs));
}

export function getMomentClock(urn: string): PlaybackClock {
  const mine = live?.urn === urn;
  return {
    pos: mine ? positionMs / 1000 : 0,
    at: positionAt,
    rate: 1,
    playing: mine && phase === 'playing',
  };
}

function setPosition(ms: number) {
  positionMs = ms;
  positionAt = performance.now();
}

export function subscribeMomentProgress(listener: () => void): () => void {
  progressListeners.add(listener);
  return () => progressListeners.delete(listener);
}

export function useMomentPhase(urn: string): MomentPhase {
  return useSyncExternalStore(subscribePhase, () => (phaseUrn === urn ? phase : 'idle'));
}

export function useAnyMomentPlaying(): boolean {
  return useSyncExternalStore(subscribePhase, () => phase === 'playing');
}

function subscribePhase(listener: () => void): () => void {
  phaseListeners.add(listener);
  return () => phaseListeners.delete(listener);
}

function setPhase(next: MomentPhase, urn: string | null) {
  if (phase === next && phaseUrn === urn) return;
  phase = next;
  phaseUrn = urn;
  for (const l of phaseListeners) l();
}

function notifyProgress() {
  if (document.visibilityState === 'hidden') return;
  for (const l of progressListeners) l();
}

function onTick(gen: number, ms: number) {
  if (!live || live.gen !== gen) return;
  setPosition(ms);
  notifyProgress();
  const endAt = live.window.startMs + live.window.lengthMs;
  if (ms >= endAt) fireEnd();
}

function onEnded(gen: number) {
  if (live?.gen === gen) fireEnd();
}

function fireEnd() {
  if (!live || live.endFired) return;
  clearWindowEnd();
  live.endFired = true;
  onWindowEnd?.(live.urn);
}

function scheduleWindowEnd(current: Live, fromMs: number) {
  clearWindowEnd();
  const remaining = Math.max(0, current.window.startMs + current.window.lengthMs - fromMs);
  endTimer = setTimeout(() => {
    if (live?.gen === current.gen) fireEnd();
  }, remaining + 40);
}

function clearWindowEnd() {
  if (!endTimer) return;
  clearTimeout(endTimer);
  endTimer = null;
}

function disarmActiveWindow() {
  clearWindowEnd();
  if (live) live.endFired = true;
}

function previewVolume(): number {
  return Math.min(2, Math.max(0, usePlayerStore.getState().volume / 100));
}
