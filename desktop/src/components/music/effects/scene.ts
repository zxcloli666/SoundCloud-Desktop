import type { Frame } from './clock';

export interface Scene {
  reverb: number;
  room: number;
  eightD: boolean;
  eightDHz: number;
  bassDb: number;
  rate: number;
}

const TAU = Math.PI * 2;
const RINGS = 4;
const STREAKS = 7;

const rgba = (rgb: string, alpha: number) => `rgba(${rgb},${Math.max(0, Math.min(1, alpha))})`;

function ripples(ctx: CanvasRenderingContext2D, w: number, h: number, f: Frame, s: Scene) {
  const period = 1.6 + 2.4 * s.room;
  const reach = Math.hypot(w, h) * (0.35 + 0.35 * s.room);
  ctx.lineWidth = 1.5;
  for (let i = 0; i < RINGS; i++) {
    const phase = (f.t / period + i / RINGS) % 1;
    const alpha = (1 - phase) ** 1.6 * (0.2 + 0.6 * s.reverb) * (0.65 + 0.35 * f.level);
    ctx.strokeStyle = rgba(f.accent, alpha);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 6 + phase * reach, 0, TAU);
    ctx.stroke();
  }
}

function orbit(ctx: CanvasRenderingContext2D, w: number, h: number, f: Frame, s: Scene) {
  const rx = w * 0.36;
  const ry = h * 0.28;
  ctx.strokeStyle = rgba(f.ink, 0.12);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, rx, ry, 0, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = rgba(f.ink, 0.22);
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.08, 0, TAU);
  ctx.fill();
  for (let k = 14; k >= 0; k--) {
    const angle = (f.t - k * 0.06) * s.eightDHz * TAU * 2.4;
    const x = w / 2 + Math.sin(angle) * rx;
    const y = h / 2 + Math.cos(angle) * ry;
    const head = k === 0;
    const size = head ? 3.5 + 3 * f.level : 2.6 * (1 - k / 16);
    ctx.fillStyle = rgba(f.accent, head ? 1 : 0.5 * (1 - k / 15));
    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fill();
  }
}

function shelf(ctx: CanvasRenderingContext2D, w: number, h: number, f: Frame, s: Scene) {
  const base = h * 0.78;
  const lift = (h * 0.5 * s.bassDb) / 12;
  const pulse = 1 + 0.35 * f.bass;
  const path = new Path2D();
  path.moveTo(0, base);
  for (let x = 0; x <= w; x += 3) {
    const octave = (x / w) * 4;
    const curve = 1 / (1 + 2 ** ((octave - 1.6) * 3.2));
    path.lineTo(x, base - lift * pulse * curve);
  }
  const line = new Path2D(path);
  path.lineTo(w, base);
  path.closePath();
  const fill = ctx.createLinearGradient(0, base - lift * 1.4, 0, base);
  fill.addColorStop(0, rgba(f.accent, 0.55));
  fill.addColorStop(1, rgba(f.accent, 0));
  ctx.fillStyle = fill;
  ctx.fill(path);
  ctx.strokeStyle = rgba(f.accent, 0.95);
  ctx.lineWidth = 2;
  ctx.stroke(line);
}

function streaks(ctx: CanvasRenderingContext2D, w: number, h: number, f: Frame, s: Scene) {
  const speed = 0.18 * s.rate ** 2;
  const length = w * 0.16 * s.rate;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < STREAKS; i++) {
    const x = ((f.t * speed + i * 0.377) % 1) * (w + length) - length;
    const y = h * (0.14 + 0.72 * ((i * 0.618) % 1));
    const fade = Math.sin(Math.max(0, Math.min(1, (x + length / 2) / w)) * Math.PI);
    ctx.strokeStyle = rgba(f.accent, 0.12 + 0.5 * fade * (0.6 + 0.4 * f.level));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + length, y);
    ctx.stroke();
  }
}

function idleLine(ctx: CanvasRenderingContext2D, w: number, h: number, f: Frame) {
  ctx.strokeStyle = rgba(f.ink, 0.16 + 0.1 * f.level);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 4) {
    const wave = Math.sin(x / 18 + f.t * 2) * 2 * f.level;
    if (x === 0) ctx.moveTo(x, h / 2 + wave);
    else ctx.lineTo(x, h / 2 + wave);
  }
  ctx.stroke();
}

export function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, f: Frame, s: Scene) {
  ctx.clearRect(0, 0, w, h);
  const rated = Math.abs(s.rate - 1) > 0.01;
  const live = s.reverb > 0 || s.eightD || s.bassDb > 0 || rated;
  if (!live) return idleLine(ctx, w, h, f);
  if (s.bassDb > 0) shelf(ctx, w, h, f, s);
  if (rated) streaks(ctx, w, h, f, s);
  if (s.reverb > 0) ripples(ctx, w, h, f, s);
  if (s.eightD) orbit(ctx, w, h, f, s);
}
