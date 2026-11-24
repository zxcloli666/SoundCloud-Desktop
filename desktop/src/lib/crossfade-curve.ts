export const CROSSFADE_CURVES = ['equal_power', 'linear', 'smooth'] as const;

export type CrossfadeCurve = (typeof CROSSFADE_CURVES)[number];

const RISE: Record<CrossfadeCurve, (progress: number) => number> = {
  equal_power: (progress) => Math.sin((progress * Math.PI) / 2),
  linear: (progress) => progress,
  smooth: (progress) => progress * progress * (3 - 2 * progress),
};

export function incomingGain(curve: CrossfadeCurve, progress: number): number {
  return RISE[curve](Math.min(1, Math.max(0, progress)));
}

export function outgoingGain(curve: CrossfadeCurve, progress: number): number {
  return incomingGain(curve, 1 - progress);
}
