export type VoiceGender = 'female' | 'male';

const VOICES = [
  { id: 'loli', gender: 'female' },
  { id: 'moriarty', gender: 'male' },
  { id: 'af_heart', gender: 'female' },
  { id: 'am_michael', gender: 'male' },
] as const satisfies { id: string; gender: VoiceGender }[];

export type VoiceId = (typeof VOICES)[number]['id'];

export const VOICE_IDS: VoiceId[] = VOICES.map((voice) => voice.id);

export const DEFAULT_VOICE: VoiceId = VOICES[0].id;

function declared(id: unknown) {
  return VOICES.find((voice) => voice.id === id) ?? VOICES[0];
}

export function knownVoice(id: unknown): VoiceId {
  return declared(id).id;
}

export function voiceGender(id: unknown): VoiceGender {
  return declared(id).gender;
}
