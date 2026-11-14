import type { VoiceConfig } from './types';

export const SAVED_VERSION = 2;

interface Saved {
  config?: VoiceConfig;
}

export function upgradeSaved<T extends Saved>(saved: T, version: number): T {
  if (version >= SAVED_VERSION || !saved.config) return saved;
  return { ...saved, config: { ...saved.config, llm: true } };
}
