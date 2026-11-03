import { listen } from '@tauri-apps/api/event';
import { isAppIdle } from '../../../lib/perf';
import { createSpectrumClaim } from '../../../lib/spectrum';

export interface Frame {
  t: number;
  level: number;
  bass: number;
  accent: string;
  ink: string;
}

type Painter = (frame: Frame) => void;

const FRAME_MS = 33;
const BASS_BINS = 8;
const COLOR_EVERY = 60;

const painters = new Set<Painter>();
const claim = createSpectrumClaim();
const bins: number[] = [];
const frame: Frame = { t: 0, level: 0, bass: 0, accent: '255,85,0', ink: '255,255,255' };

let raf = 0;
let last = 0;
let ticks = 0;
let unlisten: Promise<() => void> | null = null;

function channels(name: string, fallback: string) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const parts = raw.match(/\d+/g);
  return parts && parts.length >= 3 ? parts.slice(0, 3).join(',') : fallback;
}

function readColors() {
  frame.accent = channels('--accent-rgb', frame.accent);
  frame.ink = channels('--ink', frame.ink);
}

function mean(from: number, to: number) {
  let sum = 0;
  for (let i = from; i < to; i++) sum += bins[i] ?? 0;
  return sum / Math.max(1, to - from);
}

function step(now: number) {
  raf = requestAnimationFrame(step);
  if (now - last < FRAME_MS || isAppIdle()) return;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (ticks++ % COLOR_EVERY === 0) readColors();
  frame.t += dt;
  frame.level += (mean(0, bins.length) * 2.2 - frame.level) * 0.35;
  frame.bass += (mean(0, BASS_BINS) * 2.2 - frame.bass) * 0.35;
  for (const paint of painters) paint(frame);
}

function start() {
  last = performance.now();
  claim(true);
  unlisten = listen<number[]>('audio:fft', (event) => {
    bins.length = 0;
    bins.push(...event.payload);
  });
  raf = requestAnimationFrame(step);
}

function stop() {
  cancelAnimationFrame(raf);
  claim(false);
  void unlisten?.then((off) => off());
  unlisten = null;
  bins.length = 0;
}

export function paintStill(paint: Painter) {
  readColors();
  paint({ ...frame, t: 1.3, level: 0.35, bass: 0.35 });
}

export function watchFrames(paint: Painter) {
  readColors();
  painters.add(paint);
  if (painters.size === 1) start();
  return () => {
    painters.delete(paint);
    if (painters.size === 0) stop();
  };
}
