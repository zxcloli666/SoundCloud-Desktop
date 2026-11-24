import { EQ_BAND_COUNT, EQ_MAX_GAIN, EQ_MIN_GAIN } from '../equalizer.ts';

export interface Point {
  x: number;
  y: number;
}

const GAIN_STEP = 0.5;

export const bandX = (band: number) => (band + 0.5) / EQ_BAND_COUNT;
export const gainY = (gain: number) => (EQ_MAX_GAIN - gain) / (EQ_MAX_GAIN - EQ_MIN_GAIN);

export function bandAt(x: number) {
  return Math.max(0, Math.min(EQ_BAND_COUNT - 1, Math.floor(x * EQ_BAND_COUNT)));
}

export function clampGain(gain: number) {
  const stepped = Math.round(gain / GAIN_STEP) * GAIN_STEP;
  return Math.max(EQ_MIN_GAIN, Math.min(EQ_MAX_GAIN, stepped));
}

export function gainAt(y: number) {
  return clampGain(EQ_MAX_GAIN - y * (EQ_MAX_GAIN - EQ_MIN_GAIN));
}

export function curvePoints(gains: readonly number[], width: number, height: number): Point[] {
  const dots = gains.map((gain, band) => ({ x: bandX(band) * width, y: gainY(gain) * height }));
  const first = dots[0];
  const last = dots[dots.length - 1];
  return [{ x: 0, y: first.y }, ...dots, { x: width, y: last.y }];
}

function slopes(points: readonly Point[]) {
  const steps = points.slice(1).map((p, i) => (p.y - points[i].y) / (p.x - points[i].x));
  return points.map((_, i) => {
    const before = steps[i - 1];
    const after = steps[i];
    if (before === undefined) return after;
    if (after === undefined) return before;
    return before * after <= 0 ? 0 : (2 * before * after) / (before + after);
  });
}

export function curvePath(points: readonly Point[]) {
  const slope = slopes(points);
  const round = (n: number) => Math.round(n * 100) / 100;
  let path = `M${round(points[0].x)} ${round(points[0].y)}`;
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const third = (to.x - from.x) / 3;
    path += `C${round(from.x + third)} ${round(from.y + slope[i - 1] * third)} ${round(
      to.x - third,
    )} ${round(to.y - slope[i] * third)} ${round(to.x)} ${round(to.y)}`;
  }
  return path;
}
