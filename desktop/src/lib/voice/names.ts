import type { EngineConfig, VoiceConfig } from './types';

export interface VoiceLocale {
  voice: { voices: Record<string, { name?: string }> };
}

function voiceNames(voice: string, locales: VoiceLocale[]): string[] {
  const names = locales.map((locale) => locale.voice.voices[voice]?.name);
  return [...new Set(names.filter((name): name is string => Boolean(name)))];
}

export function engineConfig(config: VoiceConfig, locales: VoiceLocale[]): EngineConfig {
  return { ...config, names: voiceNames(config.speak.voice, locales) };
}
