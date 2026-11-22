export const WAVE_BAR_COUNT = 120;

export function fallbackBars(count: number): number[] {
  return Array.from({ length: count }, (_, i) => {
    const slow = Math.sin(i * 0.21) * 0.5 + 0.5;
    const fast = Math.sin(i * 1.7 + 1.3) * 0.5 + 0.5;
    return Math.round(24 + slow * 34 + fast * 22);
  });
}

export function peakBars(samples: number[], height: number, count: number): number[] {
  if (!samples.length || height <= 0) return fallbackBars(count);
  const bucket = samples.length / count;
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor(index * bucket);
    const end = Math.max(start + 1, Math.floor((index + 1) * bucket));
    let peak = 0;
    for (let i = start; i < end && i < samples.length; i++) peak = Math.max(peak, samples[i]);
    return Math.round(14 + Math.min(1, peak / height) * 86);
  });
}
