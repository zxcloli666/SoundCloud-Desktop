import type { VoiceLanguage } from '../../lib/voice/types';

export interface VoiceInfo {
  id: string;
  lang: VoiceLanguage;
  tags: string[];
  colors: [string, string];
  robot?: boolean;
}

export const VOICES: VoiceInfo[] = [
  { id: 'lolya', lang: 'ru', tags: ['cute', 'bright'], colors: ['#ff8fd6', '#8b5cf6'] },
  { id: 'calm', lang: 'ru', tags: ['soft', 'calm'], colors: ['#6ee7d4', '#0284c7'] },
  { id: 'male', lang: 'ru', tags: ['deep'], colors: ['#93a5ff', '#3730a3'] },
  { id: 'robot', lang: 'ru', tags: ['synth', 'fun'], colors: ['#a5f3fc', '#475569'], robot: true },
  { id: 'af_heart', lang: 'en', tags: ['warm'], colors: ['#fda4af', '#ea580c'] },
  { id: 'am_michael', lang: 'en', tags: ['clear'], colors: ['#fcd34d', '#b45309'] },
];

export function voiceById(id: string): VoiceInfo {
  return VOICES.find((v) => v.id === id) ?? VOICES[0];
}
