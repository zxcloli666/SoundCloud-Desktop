import type { Track } from '../stores/player';
import { loadWaveform } from './waveform';

export const MOMENT_MS = 30_000;

const INTRO_SHARE = 0.08;
const FALLBACK_SHARE = 0.35;
const MIN_SCAN_MS = 20_000;
const WAVEFORM_WAIT_MS = 1200;
const MOMENT_WAVEFORM_WAIT_MS = 180;
const DERIVED_CAP = 400;

export interface MomentWindow {
  startMs: number;
  lengthMs: number;
}

const derived = new Map<string, number>();

export function trackMoment(track: Track): MomentWindow | null {
  const h = track.highlight;
  if (!h || !Number.isFinite(h.startMs) || !(h.lengthMs > 0)) return null;
  return fitWindow(track, h.startMs, h.lengthMs);
}

export function hasMoment(track: Track): boolean {
  return trackMoment(track) !== null;
}

export async function momentWindow(track: Track): Promise<MomentWindow> {
  const moment = trackMoment(track);
  if (moment) return moment;
  return fitWindow(
    track,
    await previewStartMs(track, MOMENT_MS, MOMENT_WAVEFORM_WAIT_MS),
    MOMENT_MS,
  );
}

export async function previewStartMs(
  track: Track,
  lengthMs: number,
  waitMs = WAVEFORM_WAIT_MS,
): Promise<number> {
  const moment = trackMoment(track);
  if (moment) return fitWindow(track, moment.startMs, lengthMs).startMs;
  const known = derived.get(track.urn);
  if (known !== undefined) return known;
  const samples = await Promise.race([loadWaveform(track), wait(waitMs)]);
  const durationMs = track.duration;
  const guess = samples
    ? loudestStartMs(samples.values, durationMs, Math.max(lengthMs, MIN_SCAN_MS))
    : durationMs * FALLBACK_SHARE;
  const startMs = fitWindow(track, guess, lengthMs).startMs;
  if (samples) remember(track.urn, startMs);
  return startMs;
}

function fitWindow(track: Track, startMs: number, lengthMs: number): MomentWindow {
  const durationMs = Math.max(0, track.duration || 0);
  const length = Math.min(lengthMs, durationMs || lengthMs);
  const latest = Math.max(0, durationMs - length);
  return { startMs: Math.round(Math.min(Math.max(0, startMs), latest)), lengthMs: length };
}

function loudestStartMs(values: number[], durationMs: number, windowMs: number): number {
  const n = values.length;
  const fallback = durationMs * FALLBACK_SHARE;
  if (n === 0 || durationMs <= windowMs) return fallback;
  const width = Math.max(1, Math.round((n * windowMs) / durationMs));
  const from = Math.floor(n * INTRO_SHARE);
  if (from + width >= n) return fallback;
  let sum = 0;
  for (let i = from; i < from + width; i++) sum += values[i];
  let best = sum;
  let bestAt = from;
  for (let i = from + 1; i + width <= n; i++) {
    sum += values[i + width - 1] - values[i - 1];
    if (sum > best) {
      best = sum;
      bestAt = i;
    }
  }
  return (bestAt / n) * durationMs;
}

function remember(urn: string, startMs: number) {
  if (derived.size >= DERIVED_CAP) {
    const oldest = derived.keys().next().value;
    if (oldest !== undefined) derived.delete(oldest);
  }
  derived.set(urn, startMs);
}

function wait(ms: number): Promise<null> {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}
