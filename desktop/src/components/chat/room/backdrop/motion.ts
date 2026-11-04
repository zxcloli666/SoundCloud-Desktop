import { grainTile } from './grain';

export type Tone = 'dark' | 'light';

const SWEEP_MS = 18_000;
const SWEEP_TRAVEL = 0.62;
const DRIFT_X_MS = 47_000;
const DRIFT_Y_MS = 61_000;
const STILL_T = 7_300;

const SHEEN: Record<Tone, number> = { dark: 0.075, light: 0.22 };
const GRAIN: Record<Tone, number> = { dark: 0.16, light: 0.1 };

export interface MotionTarget {
  canvas: HTMLCanvasElement;
  image: HTMLElement;
  tone: Tone;
  scale: number;
  pattern: CanvasPattern | null;
}

function sweepAt(t: number) {
  const phase = (t % SWEEP_MS) / SWEEP_MS;
  if (phase > SWEEP_TRAVEL) return null;
  const x = phase / SWEEP_TRAVEL;
  return x * x * (3 - 2 * x);
}

function drift(image: HTMLElement, t: number) {
  const x = Math.sin((t / DRIFT_X_MS) * Math.PI * 2) * 1.6;
  const y = Math.cos((t / DRIFT_Y_MS) * Math.PI * 2) * 1.1;
  image.style.transform = `translate3d(${x.toFixed(3)}%, ${y.toFixed(3)}%, 0) scale(1.07)`;
}

function sweep(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  tone: Tone,
) {
  const at = sweepAt(t);
  if (at === null) return;
  const span = width + height;
  const center = -height + at * (span + height);
  const band = span * 0.22;
  const gradient = context.createLinearGradient(center - band, 0, center + band, height * 0.6);
  const peak = SHEEN[tone] * Math.sin(at * Math.PI);
  gradient.addColorStop(0, 'rgb(255 255 255 / 0)');
  gradient.addColorStop(0.5, `rgb(255 255 255 / ${peak.toFixed(3)})`);
  gradient.addColorStop(1, 'rgb(255 255 255 / 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function grain(context: CanvasRenderingContext2D, target: MotionTarget) {
  const { width, height } = target.canvas;
  target.pattern ??= context.createPattern(grainTile(), 'repeat');
  const pattern = target.pattern;
  if (!pattern) return;
  const ox = Math.floor(Math.random() * 96);
  const oy = Math.floor(Math.random() * 96);
  context.save();
  context.globalAlpha = GRAIN[target.tone];
  context.translate(-ox, -oy);
  context.fillStyle = pattern;
  context.fillRect(0, 0, width + ox, height + oy);
  context.restore();
}

export function paintMotion(target: MotionTarget, t: number) {
  const { canvas, image, tone } = target;
  const context = canvas.getContext('2d');
  if (!context) return;
  drift(image, t);
  context.clearRect(0, 0, canvas.width, canvas.height);
  sweep(context, canvas.width, canvas.height, t, tone);
  grain(context, target);
}

export function paintStill(target: MotionTarget) {
  paintMotion(target, STILL_T);
}

export function fitCanvas(target: MotionTarget) {
  const { canvas, scale } = target;
  const width = Math.max(1, Math.round(canvas.clientWidth * scale));
  const height = Math.max(1, Math.round(canvas.clientHeight * scale));
  if (canvas.width === width && canvas.height === height) return false;
  canvas.width = width;
  canvas.height = height;
  return true;
}

export function runMotion(target: MotionTarget, fps: number): () => void {
  const step = 1000 / fps;
  let frame = 0;
  let last = 0;
  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    if (now - last < step - 2) return;
    last = now - ((now - last) % step);
    paintMotion(target, now);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}
