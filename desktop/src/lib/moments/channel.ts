import { listen } from '@tauri-apps/api/event';
import { useSyncExternalStore } from 'react';
import { type Track, usePlayerStore } from '../../stores/player';
import { claimPreviewChannel, nextPreviewGen } from '../audioPreview';
import { ensureTrackCached, expectedDurationMs } from '../cache';
import { trackedInvoke as invoke } from '../diagnostics';
import { type MomentWindow, trackMoment } from '../moment';

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
let phase: MomentPhase = 'idle';
let phaseUrn: string | null = null;
let token = 0;
let onWindowEnd: ((urn: string) => void) | null = null;

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
    if (state.isPlaying && !prev.isPlaying && phase === 'playing') pauseMoment();
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
  const moment = trackMoment(track);
  if (!moment) return false;
  const mine = ++token;
  setPhase('loading', track.urn);
  try {
    const info = await ensureTrackCached(
      track.urn,
      undefined,
      expectedDurationMs(track),
      track._scd_meta?.storage_quality,
    );
    if (mine !== token) return false;
    const player = usePlayerStore.getState();
    if (player.isPlaying) player.pause();
    const gen = nextPreviewGen();
    const startedMs = await invoke<number>('audio_preview_play', {
      request: {
        path: info.path,
        volume: previewVolume(),
        gen,
        startMs: moment.startMs,
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
    live = {
      urn: track.urn,
      path: info.path,
      window: { ...moment, startMs },
      gen,
      endFired: false,
    };
    positionMs = startMs;
    notifyProgress();
    setPhase('playing', track.urn);
    return true;
  } catch (e) {
    console.debug('[moments] play failed', e);
    if (mine === token) setPhase('failed', track.urn);
    return false;
  }
}

export function pauseMoment(): void {
  if (!live || phase !== 'playing') return;
  invoke('audio_preview_pause', { paused: true, gen: live.gen }).catch(() => {});
  setPhase('paused', live.urn);
}

export function resumeMoment(): boolean {
  if (!live || phase !== 'paused' || live.endFired) return false;
  const player = usePlayerStore.getState();
  if (player.isPlaying) player.pause();
  invoke('audio_preview_pause', { paused: false, gen: live.gen }).catch(() => {});
  setPhase('playing', live.urn);
  return true;
}

export async function seekMoment(urn: string, share: number): Promise<void> {
  const current = live;
  if (!current || current.urn !== urn) return;
  const { startMs, lengthMs } = current.window;
  const targetMs = Math.round(startMs + Math.min(0.98, Math.max(0, share)) * lengthMs);
  const mine = ++token;
  const gen = nextPreviewGen();
  const player = usePlayerStore.getState();
  if (player.isPlaying) player.pause();
  try {
    await invoke<number>('audio_preview_play', {
      request: {
        path: current.path,
        volume: previewVolume(),
        gen,
        startMs: targetMs,
        fadeInMs: SEEK_FADE_MS,
        crossfadeMs: SEEK_FADE_MS,
        report: true,
      },
    });
  } catch (e) {
    console.debug('[moments] seek failed', e);
    return;
  }
  if (mine !== token || live !== current) {
    invoke('audio_preview_stop', { fadeMs: 0, gen }).catch(() => {});
    return;
  }
  live = { ...current, gen, endFired: false };
  positionMs = targetMs;
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
  live = null;
  invoke('audio_preview_stop', { fadeMs: STOP_FADE_MS, gen: 0 }).catch(() => {});
  setPhase('handed', urn);
}

export function stopMoments(fadeMs: number): void {
  token += 1;
  const wasLive = live !== null;
  live = null;
  positionMs = 0;
  if (wasLive) invoke('audio_preview_stop', { fadeMs, gen: 0 }).catch(() => {});
  setPhase('idle', null);
}

export function prefetchMoment(track: Track): void {
  if (!trackMoment(track)) return;
  ensureTrackCached(
    track.urn,
    undefined,
    expectedDurationMs(track),
    track._scd_meta?.storage_quality,
    true,
  ).catch(() => {});
}

export function momentShare(urn: string): number {
  if (!live || live.urn !== urn) return 0;
  const { startMs, lengthMs } = live.window;
  if (lengthMs <= 0) return 0;
  return Math.min(1, Math.max(0, (positionMs - startMs) / lengthMs));
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
  positionMs = ms;
  notifyProgress();
  const endAt = live.window.startMs + live.window.lengthMs - AUTO_CROSSFADE_MS;
  if (ms >= endAt) fireEnd();
}

function onEnded(gen: number) {
  if (live?.gen === gen) fireEnd();
}

function fireEnd() {
  if (!live || live.endFired) return;
  live.endFired = true;
  onWindowEnd?.(live.urn);
}

function previewVolume(): number {
  return Math.min(2, Math.max(0, usePlayerStore.getState().volume / 100));
}
