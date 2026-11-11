import type { VoiceLanguage } from '../../lib/voice/types';
import type { VoiceId } from '../../lib/voice/voice-ids';
import loliImage from './avatars/loli.jpg';
import moriartyImage from './avatars/moriarty.jpg';

const QWEN_LOLI = 'qwen-loli';
const QWEN_MORIARTY = 'qwen-moriarty';
const KOKORO = 'kokoro-int8-multi-lang-v1_0';

export interface VoiceInfo {
  id: VoiceId;
  model: string;
  lang: VoiceLanguage;
  tags: string[];
  glow: string;
  image?: string;
}

export const VOICES: VoiceInfo[] = [
  {
    id: 'loli',
    model: QWEN_LOLI,
    lang: 'ru',
    tags: ['cute', 'bright'],
    glow: 'var(--color-rose-200)',
    image: loliImage,
  },
  {
    id: 'moriarty',
    model: QWEN_MORIARTY,
    lang: 'ru',
    tags: ['deep'],
    glow: 'var(--color-amber-500)',
    image: moriartyImage,
  },
  { id: 'af_heart', model: KOKORO, lang: 'en', tags: ['warm'], glow: 'var(--color-rose-400)' },
  {
    id: 'am_michael',
    model: KOKORO,
    lang: 'en',
    tags: ['clear'],
    glow: 'var(--color-amber-300)',
  },
];

export function voiceOfModel(model: string): VoiceInfo | undefined {
  return [QWEN_LOLI, QWEN_MORIARTY].includes(model)
    ? VOICES.find((v) => v.model === model)
    : undefined;
}

export function voiceById(id: string): VoiceInfo {
  return VOICES.find((v) => v.id === id) ?? VOICES[0];
}
