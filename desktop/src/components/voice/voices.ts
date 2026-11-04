import type { VoiceLanguage } from '../../lib/voice/types';
import lolyaImage from './avatars/lolya.jpg';
import moriartyImage from './avatars/moriarty.jpg';

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
  {
    id: 'moriarty',
    lang: 'ru',
    tags: ['deep'],
    glow: 'var(--color-amber-500)',
    image: moriartyImage,
  },
  { id: 'robot', lang: 'ru', tags: ['synth', 'fun'], glow: 'rgb(var(--mint))' },
  { id: 'af_heart', lang: 'en', tags: ['warm'], glow: 'var(--color-rose-400)' },
  { id: 'am_michael', lang: 'en', tags: ['clear'], glow: 'var(--color-amber-300)' },
];

export function voiceById(id: string): VoiceInfo {
  return VOICES.find((v) => v.id === id) ?? VOICES[0];
}
