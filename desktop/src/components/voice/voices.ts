import type { VoiceLanguage } from '../../lib/voice/types';
import lolyaImage from './avatars/lolya.jpg';

export interface VoiceInfo {
  id: string;
  lang: VoiceLanguage;
  tags: string[];
  glow: string;
  image?: string;
}

export const VOICES: VoiceInfo[] = [
  {
    id: 'lolya',
    lang: 'ru',
    tags: ['cute', 'bright'],
    glow: 'var(--color-rose-200)',
    image: lolyaImage,
  },
  { id: 'calm', lang: 'ru', tags: ['soft', 'calm'], glow: 'var(--color-sky-300)' },
  { id: 'male', lang: 'ru', tags: ['deep'], glow: 'var(--color-violet-400)' },
  { id: 'robot', lang: 'ru', tags: ['synth', 'fun'], glow: 'rgb(var(--mint))' },
  { id: 'af_heart', lang: 'en', tags: ['warm'], glow: 'var(--color-rose-400)' },
  { id: 'am_michael', lang: 'en', tags: ['clear'], glow: 'var(--color-amber-300)' },
];

export function voiceById(id: string): VoiceInfo {
  return VOICES.find((v) => v.id === id) ?? VOICES[0];
}
