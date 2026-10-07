export const AUDIO_CACHE_OFF = -1;
export const AUDIO_CACHE_UNLIMITED = 0;

const MB_PER_GB = 1024;
const MAX_LIMIT_GB = 8;

export const AUDIO_CACHE_STEPS = [
  AUDIO_CACHE_OFF,
  ...Array.from({ length: MAX_LIMIT_GB }, (_, i) => (i + 1) * MB_PER_GB),
  AUDIO_CACHE_UNLIMITED,
];

export function isAudioCacheOff(limitMb: number): boolean {
  return limitMb < 0;
}

export function isAudioCacheUnlimited(limitMb: number): boolean {
  return limitMb === AUDIO_CACHE_UNLIMITED;
}

export function audioCacheStep(limitMb: number): number {
  if (isAudioCacheOff(limitMb)) return 0;
  if (isAudioCacheUnlimited(limitMb)) return AUDIO_CACHE_STEPS.length - 1;
  return Math.min(MAX_LIMIT_GB, Math.max(1, Math.ceil(limitMb / MB_PER_GB)));
}

export function normalizeAudioCacheLimit(limitMb: unknown): number {
  if (typeof limitMb !== 'number' || !Number.isFinite(limitMb)) return MB_PER_GB;
  return AUDIO_CACHE_STEPS[audioCacheStep(limitMb)];
}
