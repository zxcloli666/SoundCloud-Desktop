const SAMPLES = 24;

export function curvePath(
  from: number,
  to: number,
  top: number,
  bottom: number,
  gain: (progress: number) => number,
): string {
  const points: string[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const progress = i / SAMPLES;
    const x = from + (to - from) * progress;
    const y = bottom - (bottom - top) * gain(progress);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(' L');
}
