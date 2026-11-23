import type { VoiceConfig } from './types';
import { knownVoice } from './voice-ids.ts';

export const SAVED_VERSION = 2;

interface Saved {
  config?: VoiceConfig;
}

export function upgradeSaved<T extends Saved>(saved: T, version: number): T {
  if (version >= SAVED_VERSION || !saved.config) return saved;
  return { ...saved, config: { ...saved.config, llm: true } };
}

export function mergeConfig(base: VoiceConfig, config: Partial<VoiceConfig>): VoiceConfig {
  return {
    ...base,
    ...config,
    activation: {
      ...base.activation,
      ...config.activation,
      wake: { ...base.activation.wake, ...config.activation?.wake },
    },
    listen: { ...base.listen, ...config.listen },
    speak: {
      ...base.speak,
      ...config.speak,
      voice: knownVoice(config.speak?.voice),
    },
    boosts: { ...base.boosts, ...config.boosts },
    listener: { ...base.listener, ...config.listener },
    relation: { ...base.relation, ...config.relation },
    follow: { ...base.follow, ...config.follow },
  };
}
